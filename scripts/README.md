# Paradex Docs Automation Scripts

This directory contains automation scripts for common documentation tasks in the Paradex docs repository.

## Available Scripts

### 1. `docs_automation.py` - Main CLI Interface
The main script that provides a unified interface for all automation tasks.

```bash
# Update market field (just provide the number)
python docs_automation.py update-market aster-usd-perp positionLimit 2000000

# Add new market
python docs_automation.py add-market new-token-usd-perp tier2

# Create release page
python docs_automation.py create-release v1.114
```

### 2. `update_market_field.py` - Update Market Fields
Updates specific fields in existing market files.

**Usage:**
```bash
python update_market_field.py <market_name> <field_name> <new_value>
```

**Example:**
```bash
python update_market_field.py aster-usd-perp positionLimit 2000000
python update_market_field.py aster-usd-perp imf 15
python update_market_field.py aster-usd-perp fundingPeriod 4
```

**Available Fields:**
- `fundingPeriod` (time) - e.g., 4 → "4 hours"
- `tickSize` (currency) - e.g., 0.0001 → "0.0001 USD"
- `orderSizeIncrement` (token) - e.g., 1 → "1 ASTER"
- `minOrderValue` (currency) - e.g., 50 → "50 USD"
- `maxOpenOrders` (number) - e.g., 100 → "100"
- `maxOrderSize` (token) - e.g., 500000 → "500,000 ASTER"
- `positionLimit` (token) - e.g., 2000000 → "2,000,000 ASTER"
- `imf` (percentage) - e.g., 15 → "15.0%"
- `mmf` (percentage) - e.g., 50 → "50.0%"

**Smart Value Conversion:**
The script automatically formats numerical values:
- Large numbers get comma separators (2000000 → 2,000,000)
- Token fields automatically use the market's base currency
- Percentages are formatted with % symbol
- Currency fields get USD suffix
- Time fields get "hours" suffix

### 3. `add_new_market.py` - Add New Markets
Creates new market files and updates docs.yml navigation.

**Usage:**
```bash
python add_new_market.py <market_name> <tier> [config_file]
```

**Examples:**
```bash
# Add tier-2 market with default config
python add_new_market.py new-token-usd-perp tier2

# Add tier-1 market with custom config
python add_new_market.py new-token-usd-perp tier1 custom_config.json
```

**Requirements:**
- Market name must end with `-usd-perp`
- Tier must be `tier1` or `tier2`
- Config file is optional (uses template if not provided)

### 4. `create_release_page.py` - Create Release Pages
Creates new release note pages and updates all references.

**Usage:**
```bash
python create_release_page.py <version>
```

**Example:**
```bash
python create_release_page.py v1.114
```

**What it does:**
- Creates `v1.114.md` in `pages/release-notes/`
- Updates `overview.mdx` to include the new release
- Updates `archive.mdx` to include the new release
- Updates `docs.yml` navigation

## Configuration

### Market Configuration File
Use `market_config_example.json` as a template for custom market configurations:

```json
{
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
```

## File Structure

The scripts expect the following directory structure:
```
paradex-docs/
├── fern/
│   ├── docs.yml
│   └── pages/
│       ├── instruments-guide/
│       │   └── futures/
│       │       ├── tier-1/
│       │       └── tier-2/
│       └── release-notes/
│           ├── overview.mdx
│           ├── archive.mdx
│           └── v1.xxx.md
└── scripts/
    ├── docs_automation.py
    ├── update_market_field.py
    ├── add_new_market.py
    ├── create_release_page.py
    └── market_config_example.json
```

## Error Handling

All scripts include error handling for:
- Missing files
- Invalid input formats
- Duplicate entries
- File permission issues

## Dependencies

- Python 3.6+
- No external dependencies required (uses only standard library)

## Notes

- All scripts work with the existing file structure
- Scripts automatically detect tier-1 vs tier-2 markets
- Release pages include both Prod and Testnet sections
- Market names are automatically converted to proper formats
- All changes are made in-place (backup recommended for important changes)
