#!/usr/bin/env python3
"""
Script to add a new market with tier1/tier2 support.
Usage: python add_new_market.py <market_name> <tier> [config_file]
Example: python add_new_market.py new-token-usd-perp tier2 config.json
"""

import os
import sys
import json
import re
from pathlib import Path

def get_template_config():
    """Get default template configuration for a new market."""
    return {
        "contractName": "TOKEN-USD-PERP",
        "productType": "TOKEN Perpetual Future",
        "settlementCurrency": "USDC",
        "baseCurrency": "TOKEN",
        "quoteCurrency": "USD",
        "fundingPeriod": "8 hours",
        "tickSize": "0.00001 USD",
        "orderSizeIncrement": "1 TOKEN",
        "minOrderValue": "50 USD",
        "maxOrderSize": "100,000 TOKEN",
        "maxOpenOrders": "75",
        "positionLimit": "500,000 TOKEN",
        "priceBandFactor": "20%",
        "fundingClampingRate": "5.0%",
        "ewmaFactor": "15%",
        "imf": "20%",
        "mmf": "50%"
    }

def load_config(config_file=None):
    """Load configuration from file or use template."""
    if config_file and Path(config_file).exists():
        with open(config_file, 'r') as f:
            return json.load(f)
    return get_template_config()

def create_market_file_content(market_name, config):
    """Create the content for a new market file."""
    # Convert market name to contract name format (uppercase with dashes)
    contract_name = market_name.upper().replace('-', '-')
    
    # Update config with market-specific values
    config = config.copy()
    config['contractName'] = contract_name
    
    # Extract base currency from market name (everything before -usd-perp)
    base_currency = market_name.split('-usd-perp')[0].upper()
    config['baseCurrency'] = base_currency
    config['productType'] = f"{base_currency} Perpetual Future"
    config['orderSizeIncrement'] = f"1 {base_currency}"
    config['maxOrderSize'] = config['maxOrderSize'].replace('TOKEN', base_currency)
    config['positionLimit'] = config['positionLimit'].replace('TOKEN', base_currency)
    
    # Generate the file content
    content = "---\n---\n"
    for key, value in config.items():
        content += f'export const {key} = "{value}";\n'
    content += "\n<Markdown src=\"../../../../snippets/contractTemplate.mdx\"/>\n"
    
    return content

def update_docs_yml(market_name, tier):
    """Update docs.yml to include the new market."""
    docs_yml_path = Path(__file__).parent.parent / "fern" / "docs.yml"
    
    if not docs_yml_path.exists():
        print(f"Error: docs.yml not found at {docs_yml_path}")
        return False
    
    # Read docs.yml
    with open(docs_yml_path, 'r') as f:
        content = f.read()
    
    # Convert market name to display format
    display_name = market_name.upper().replace('-', '-')
    slug_name = market_name.lower()
    
    # Create the new market entry
    new_entry = f"""                    - page: {display_name}
                      slug: {slug_name}
                      path: ./pages/instruments-guide/futures/tier-{tier[-1]}/{market_name}.mdx"""
    
    # Find the appropriate tier section and add the market
    tier_section_pattern = rf'(                - section: Tier {tier[-1]}\s+contents:)(.*?)(                - section: Tier)'
    
    if tier == "tier1":
        tier_section_pattern = rf'(                - section: Tier 1\s+contents:)(.*?)(                - section: Tier 2)'
    
    def replace_tier_section(match):
        section_header = match.group(1)
        existing_content = match.group(2)
        next_section = match.group(3)
        
        # Add the new market entry
        updated_content = existing_content + "\n" + new_entry + "\n"
        return section_header + updated_content + next_section
    
    # Apply the replacement
    new_content = re.sub(tier_section_pattern, replace_tier_section, content, flags=re.DOTALL)
    
    if new_content == content:
        print(f"Warning: Could not find Tier {tier[-1]} section in docs.yml")
        return False
    
    # Write back to file
    with open(docs_yml_path, 'w') as f:
        f.write(new_content)
    
    print(f"Successfully updated docs.yml with new market {display_name}")
    return True

def main():
    if len(sys.argv) < 3:
        print("Usage: python add_new_market.py <market_name> <tier> [config_file]")
        print("Example: python add_new_market.py new-token-usd-perp tier2 config.json")
        print("Example: python add_new_market.py new-token-usd-perp tier1")
        print("\nTier options: tier1, tier2")
        print("Config file: Optional JSON file with market configuration")
        sys.exit(1)
    
    market_name = sys.argv[1]
    tier = sys.argv[2]
    config_file = sys.argv[3] if len(sys.argv) > 3 else None
    
    # Validate tier
    if tier not in ["tier1", "tier2"]:
        print("Error: Tier must be 'tier1' or 'tier2'")
        sys.exit(1)
    
    # Validate market name format
    if not market_name.endswith('-usd-perp'):
        print("Error: Market name must end with '-usd-perp'")
        sys.exit(1)
    
    # Load configuration
    config = load_config(config_file)
    
    # Create market file path
    market_file_path = Path(__file__).parent.parent / "fern" / "pages" / "instruments-guide" / "futures" / tier / f"{market_name}.mdx"
    
    # Check if market already exists
    if market_file_path.exists():
        print(f"Error: Market file {market_file_path} already exists")
        sys.exit(1)
    
    # Create market file content
    content = create_market_file_content(market_name, config)
    
    # Create the market file
    market_file_path.parent.mkdir(parents=True, exist_ok=True)
    with open(market_file_path, 'w') as f:
        f.write(content)
    
    print(f"Successfully created market file: {market_file_path}")
    
    # Update docs.yml
    success = update_docs_yml(market_name, tier)
    if not success:
        print("Warning: Could not update docs.yml automatically")
        print(f"Please manually add the market entry to docs.yml in the Tier {tier[-1]} section")

if __name__ == "__main__":
    main()
