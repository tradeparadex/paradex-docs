# TVL Limit Auto-Generation Scripts

This directory contains scripts to automatically fetch and update the maximum Total Value Locked (TVL) limit from the Paradex smart contract on Ethereum.

## Overview

Instead of manually maintaining the TVL limit in documentation, these scripts automatically pull the current value from the blockchain contract and update the documentation at build time.

## Files

- `fetch-tvl-limit.js` - Core script to fetch TVL limit from Ethereum contract
- `generate-tvl-config.js` - Script to generate configuration file for documentation
- `README.md` - This documentation file

## How it Works

1. **Contract Interaction**: The script calls `getMaxTotalBalance` on the Paradex contract at `0xe3cbe3a636ab6a754e9e41b12b09d09ce9e53db3`
2. **Token Parameter**: Uses USDC token address `0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48`
3. **Value Processing**: Divides the raw value by 1,000,000 to convert from wei to USDC
4. **Formatting**: Formats the value for display (e.g., "50 million USDC")
5. **Config Generation**: Creates a JSON config file that the documentation can read

## Usage

### Manual Testing
```bash
# Test fetching TVL limit
yarn fetch:tvl

# Generate TVL configuration
yarn generate:tvl
```

### Automatic Usage
The scripts are automatically run during documentation builds:

```bash
# Development server (fetches TVL limit before starting)
yarn dev

# Production build (fetches TVL limit before building)
yarn build
```

## Configuration

The generated configuration is stored in `fern/config/tvl-limit.json`:

```json
{
  "tvlLimit": {
    "rawValue": "50000000000000",
    "usdcValue": 50000000,
    "formattedValue": "50 million USDC",
    "lastUpdated": "2024-12-05T00:00:00.000Z",
    "source": "Ethereum Contract",
    "contractAddress": "0xe3cbe3a636ab6a754e9e41b12b09d09ce9e53db3"
  }
}
```

## Documentation Integration

The documentation uses the `TVLLimitDisplay` component to show the current TVL limit:

```jsx
<TVLLimitDisplay fallback="50 million USDC" />
```

This component:
- Reads the generated config file
- Displays the current TVL limit
- Falls back to the provided fallback value if the config is unavailable

## Error Handling

- If the contract call fails, the script will use a fallback value
- If the config file is missing, the component will use the fallback value
- All errors are logged for debugging

## Dependencies

- `ethers` - For Ethereum contract interaction
- Node.js built-in modules (`fs`, `path`)

## Network Configuration

The script uses a public Ethereum RPC endpoint. For production use, consider:
- Using a dedicated RPC provider
- Adding retry logic for network failures
- Implementing caching to reduce API calls

## Contract Details

- **Contract Address**: `0xe3cbe3a636ab6a754e9e41b12b09d09ce9e53db3`
- **Function**: `getMaxTotalBalance(address token)`
- **Token Address**: `0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48` (USDC)
- **Value Conversion**: Raw value ÷ 1,000,000 = USDC amount
