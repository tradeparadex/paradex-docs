#!/usr/bin/env python3
"""
Script to update market fields with numerical value conversion.
Usage: python update_market_field.py <market_name> <field_name> <new_value>
Example: python update_market_field.py aster-usd-perp positionLimit 2000000
"""

import os
import sys
import re
from pathlib import Path

# Allowed properties with their expected formats
ALLOWED_PROPERTIES = {
    'fundingPeriod': {'type': 'time', 'format': '{value} hours'},
    'tickSize': {'type': 'currency', 'format': '{value} USD'},
    'orderSizeIncrement': {'type': 'token', 'format': '{value} {token}'},
    'minOrderValue': {'type': 'currency', 'format': '{value} USD'},
    'maxOpenOrders': {'type': 'number', 'format': '{value}'},
    'maxOrderSize': {'type': 'token', 'format': '{value} {token}'},
    'positionLimit': {'type': 'token', 'format': '{value} {token}'},
    'imf': {'type': 'percentage', 'format': '{value}%'},
    'mmf': {'type': 'percentage', 'format': '{value}%'}
}

def find_market_file(market_name):
    """Find the market file for the given market name."""
    base_path = Path(__file__).parent.parent / "fern" / "pages" / "instruments-guide" / "futures"
    
    # Check tier-1 first
    tier1_path = base_path / "tier-1" / f"{market_name}.mdx"
    if tier1_path.exists():
        return tier1_path
    
    # Check tier-2
    tier2_path = base_path / "tier-2" / f"{market_name}.mdx"
    if tier2_path.exists():
        return tier2_path
    
    return None

def extract_base_currency(market_file):
    """Extract the base currency from the market file."""
    with open(market_file, 'r') as f:
        content = f.read()
    
    # Look for baseCurrency export
    match = re.search(r'export const baseCurrency = "([^"]+)";', content)
    if match:
        return match.group(1)
    
    # Fallback: extract from market name
    market_name = market_file.stem
    return market_name.split('-usd-perp')[0].upper()

def format_number_with_commas(value):
    """Format a number with commas for readability."""
    try:
        # Convert to int if it's a whole number
        if float(value) == int(float(value)):
            return f"{int(float(value)):,}"
        else:
            return f"{float(value):,}"
    except ValueError:
        return str(value)

def convert_numerical_value(field_name, raw_value, base_currency):
    """Convert raw numerical value to proper format based on field type."""
    if field_name not in ALLOWED_PROPERTIES:
        raise ValueError(f"Field '{field_name}' is not allowed")
    
    field_config = ALLOWED_PROPERTIES[field_name]
    
    try:
        # Parse the numerical value
        if field_config['type'] in ['percentage']:
            # For percentages, just use the number as-is
            formatted_value = str(float(raw_value))
        else:
            # For other types, format with commas
            formatted_value = format_number_with_commas(raw_value)
        
        # Apply the format template
        if field_config['type'] in ['token']:
            return field_config['format'].format(value=formatted_value, token=base_currency)
        else:
            return field_config['format'].format(value=formatted_value)
            
    except ValueError:
        raise ValueError(f"Invalid numerical value: {raw_value}")

def validate_field_name(field_name):
    """Validate that the field name is allowed."""
    if field_name not in ALLOWED_PROPERTIES:
        allowed_fields = ', '.join(ALLOWED_PROPERTIES.keys())
        raise ValueError(f"Field '{field_name}' is not allowed. Allowed fields: {allowed_fields}")

def update_market_field(market_file, field_name, raw_value):
    """Update a specific field in the market file."""
    if not market_file.exists():
        print(f"Error: Market file {market_file} not found")
        return False
    
    # Validate field name
    try:
        validate_field_name(field_name)
    except ValueError as e:
        print(f"Error: {e}")
        return False
    
    # Extract base currency for token-based fields
    base_currency = extract_base_currency(market_file)
    
    # Convert raw value to proper format
    try:
        formatted_value = convert_numerical_value(field_name, raw_value, base_currency)
    except ValueError as e:
        print(f"Error: {e}")
        return False
    
    # Read the file
    with open(market_file, 'r') as f:
        content = f.read()
    
    # Create regex pattern to match the field
    # Pattern matches: export const fieldName = "value";
    pattern = rf'export const {field_name} = "[^"]*";'
    replacement = f'export const {field_name} = "{formatted_value}";'
    
    # Check if field exists
    if not re.search(pattern, content):
        print(f"Error: Field '{field_name}' not found in {market_file}")
        return False
    
    # Replace the field
    new_content = re.sub(pattern, replacement, content)
    
    # Write back to file
    with open(market_file, 'w') as f:
        f.write(new_content)
    
    print(f"Successfully updated {field_name} to '{formatted_value}' in {market_file}")
    return True

def main():
    if len(sys.argv) != 4:
        print("Usage: python update_market_field.py <market_name> <field_name> <new_value>")
        print("Example: python update_market_field.py aster-usd-perp positionLimit 2000000")
        print("\nAllowed fields:")
        for field, config in ALLOWED_PROPERTIES.items():
            print(f"- {field} ({config['type']})")
        sys.exit(1)
    
    market_name = sys.argv[1]
    field_name = sys.argv[2]
    raw_value = sys.argv[3]
    
    # Find the market file
    market_file = find_market_file(market_name)
    if not market_file:
        print(f"Error: Market '{market_name}' not found in tier-1 or tier-2")
        sys.exit(1)
    
    # Update the field
    success = update_market_field(market_file, field_name, raw_value)
    if not success:
        sys.exit(1)

if __name__ == "__main__":
    main()
