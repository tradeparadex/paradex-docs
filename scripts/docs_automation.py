#!/usr/bin/env python3
"""
Main automation script for Paradex docs repository.
Provides a unified CLI interface for common documentation tasks.
"""

import os
import sys
import argparse
from pathlib import Path

def run_update_market_field(args):
    """Run the update market field script."""
    script_path = Path(__file__).parent / "update_market_field.py"
    cmd = [sys.executable, str(script_path), args.market, args.field, args.value]
    os.execv(sys.executable, cmd)

def run_add_new_market(args):
    """Run the add new market script."""
    script_path = Path(__file__).parent / "add_new_market.py"
    cmd = [sys.executable, str(script_path), args.market, args.tier]
    if args.config:
        cmd.append(args.config)
    os.execv(sys.executable, cmd)

def run_create_release_page(args):
    """Run the create release page script."""
    script_path = Path(__file__).parent / "create_release_page.py"
    cmd = [sys.executable, str(script_path), args.version]
    os.execv(sys.executable, cmd)

def main():
    parser = argparse.ArgumentParser(
        description="Paradex Docs Automation Tool",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  # Update position limit for ASTER market (just provide the number)
  python docs_automation.py update-market aster-usd-perp positionLimit 2000000
  
  # Update IMF percentage
  python docs_automation.py update-market aster-usd-perp imf 15
  
  # Update funding period
  python docs_automation.py update-market aster-usd-perp fundingPeriod 4
  
  # Add a new tier-2 market
  python docs_automation.py add-market new-token-usd-perp tier2
  
  # Add a new market with custom config
  python docs_automation.py add-market new-token-usd-perp tier2 config.json
  
  # Create a new release page
  python docs_automation.py create-release v1.114
        """
    )
    
    subparsers = parser.add_subparsers(dest='command', help='Available commands')
    
    # Update market field command
    update_parser = subparsers.add_parser('update-market', help='Update a field in an existing market')
    update_parser.add_argument('market', help='Market name (e.g., aster-usd-perp)')
    update_parser.add_argument('field', help='Field name to update (e.g., positionLimit, imf, tickSize)')
    update_parser.add_argument('value', help='New numerical value for the field (will be formatted automatically)')
    update_parser.set_defaults(func=run_update_market_field)
    
    # Add new market command
    add_market_parser = subparsers.add_parser('add-market', help='Add a new market')
    add_market_parser.add_argument('market', help='Market name (e.g., new-token-usd-perp)')
    add_market_parser.add_argument('tier', choices=['tier1', 'tier2'], help='Market tier')
    add_market_parser.add_argument('config', nargs='?', help='Optional config file (JSON)')
    add_market_parser.set_defaults(func=run_add_new_market)
    
    # Create release page command
    release_parser = subparsers.add_parser('create-release', help='Create a new release page')
    release_parser.add_argument('version', help='Version number (e.g., v1.114)')
    release_parser.set_defaults(func=run_create_release_page)
    
    args = parser.parse_args()
    
    if not args.command:
        parser.print_help()
        sys.exit(1)
    
    try:
        args.func(args)
    except KeyboardInterrupt:
        print("\nOperation cancelled by user")
        sys.exit(1)
    except Exception as e:
        print(f"Error: {e}")
        sys.exit(1)

if __name__ == "__main__":
    main()
