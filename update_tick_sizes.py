#!/usr/bin/env python3
import csv
import os
import re
from pathlib import Path

def read_csv_changes():
    """Read the CSV file and return a dict of ticker -> new tick size for changed markets"""
    changes = {}
    
    # Read the CSV file
    csv_path = "/Users/varunjain/Downloads/Tick Size Update 2.csv"
    
    with open(csv_path, 'r') as file:
        reader = csv.DictReader(file)
        for row in reader:
            ticker = row['Ticker']
            current_tick = row['Current Tick Size']
            updated_tick = row['Updated Tick Size']
            change = row['Change']
            
            # Only process markets where tick size actually changed
            if change == "More Precise" and current_tick != updated_tick:
                changes[ticker] = updated_tick
    
    return changes

def update_file_settings(file_path, new_tick_size, new_max_open_orders):
    """Update the tickSize and maxOpenOrders in an MDX file"""
    with open(file_path, 'r') as file:
        content = file.read()
    
    # Replace the tickSize line only if new_tick_size is provided
    if new_tick_size is not None:
        tick_pattern = r'export const tickSize = "[^"]*";'
        tick_replacement = f'export const tickSize = "{new_tick_size} USD";'
        content = re.sub(tick_pattern, tick_replacement, content)
    
    # Replace the maxOpenOrders line
    orders_pattern = r'export const maxOpenOrders = "[^"]*";'
    orders_replacement = f'export const maxOpenOrders = "{new_max_open_orders}";'
    content = re.sub(orders_pattern, orders_replacement, content)
    
    with open(file_path, 'w') as file:
        file.write(content)
    
    if new_tick_size is not None:
        print(f"Updated {file_path} with tick size {new_tick_size} and maxOpenOrders {new_max_open_orders}")
    else:
        print(f"Updated {file_path} with maxOpenOrders {new_max_open_orders}")

def update_all_tier_files():
    """Update maxOpenOrders for all files in tier-1 and tier-2"""
    base_dir = Path("fern/pages/instruments-guide/futures")
    
    # Update tier-1 files with maxOpenOrders = 150
    tier1_dir = base_dir / "tier-1"
    if tier1_dir.exists():
        for file_path in tier1_dir.glob("*.mdx"):
            update_file_settings(file_path, None, "150")
    
    # Update tier-2 files with maxOpenOrders = 75
    tier2_dir = base_dir / "tier-2"
    if tier2_dir.exists():
        for file_path in tier2_dir.glob("*.mdx"):
            update_file_settings(file_path, None, "75")

def main():
    # Get the changes from CSV
    changes = read_csv_changes()
    
    print(f"Found {len(changes)} markets with tick size changes:")
    for ticker, new_tick in changes.items():
        print(f"  {ticker}: {new_tick}")
    
    # Base directory for the MDX files
    base_dir = Path("fern/pages/instruments-guide/futures")
    
    # Check both tier-1 and tier-2 directories
    for tier in ["tier-1", "tier-2"]:
        tier_dir = base_dir / tier
        
        if not tier_dir.exists():
            continue
            
        for ticker, new_tick_size in changes.items():
            # Convert ticker to lowercase for filename
            ticker_lower = ticker.lower()
            
            # For k-prefixed tokens, keep the 'k' in the filename
            filename = f"{ticker_lower}-usd-perp.mdx"
            
            file_path = tier_dir / filename
            
            if file_path.exists():
                # Set maxOpenOrders based on tier
                max_orders = "150" if tier == "tier-1" else "75"
                update_file_settings(file_path, new_tick_size, max_orders)
            else:
                print(f"Warning: File not found for {ticker}: {file_path}")
    
    # Update all remaining files that don't have tick size changes
    print("\nUpdating maxOpenOrders for all remaining files...")
    update_all_tier_files()

if __name__ == "__main__":
    main() 
