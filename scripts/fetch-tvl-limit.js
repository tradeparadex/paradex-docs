#!/usr/bin/env node

const { ethers } = require('ethers');

// Configuration
const CONTRACT_ADDRESS = '0xe3cbe3a636ab6a754e9e41b12b09d09ce9e53db3';
const USDC_TOKEN_ADDRESS = '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48';
const ETHEREUM_RPC_URL = 'https://eth.llamarpc.com'; // Public RPC endpoint

// ABI for the getMaxTotalBalance function
const CONTRACT_ABI = [
  {
    "inputs": [
      {
        "internalType": "address",
        "name": "token",
        "type": "address"
      }
    ],
    "name": "getMaxTotalBalance",
    "outputs": [
      {
        "internalType": "uint256",
        "name": "",
        "type": "uint256"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  }
];

async function fetchTVLLimit() {
  try {
    console.log('Fetching TVL limit from Ethereum contract...');
    
    // Create provider
    const provider = new ethers.JsonRpcProvider(ETHEREUM_RPC_URL);
    
    // Create contract instance
    const contract = new ethers.Contract(CONTRACT_ADDRESS, CONTRACT_ABI, provider);
    
    // Call getMaxTotalBalance with USDC token address
    const maxTotalBalance = await contract.getMaxTotalBalance(USDC_TOKEN_ADDRESS);
    
    // Convert from wei to USDC (divide by 10^6 since USDC has 6 decimals)
    const tvlLimitInUSDC = Number(ethers.formatUnits(maxTotalBalance, 6));
    
    console.log(`Raw value from contract: ${maxTotalBalance.toString()}`);
    console.log(`TVL Limit in USDC: ${tvlLimitInUSDC.toLocaleString()}`);
    
    // Format the number for display
    const formattedLimit = formatTVLLimit(tvlLimitInUSDC);
    console.log(`Formatted TVL Limit: ${formattedLimit}`);
    
    return {
      rawValue: maxTotalBalance.toString(),
      usdcValue: tvlLimitInUSDC,
      formattedValue: formattedLimit
    };
    
  } catch (error) {
    console.error('Error fetching TVL limit:', error);
    throw error;
  }
}

function formatTVLLimit(value) {
  if (value >= 1000000) {
    const millions = value / 1000000;
    if (millions % 1 === 0) {
      return `${millions} million USDC`;
    } else {
      return `${millions.toFixed(1)} million USDC`;
    }
  } else if (value >= 1000) {
    const thousands = value / 1000;
    if (thousands % 1 === 0) {
      return `${thousands} thousand USDC`;
    } else {
      return `${thousands.toFixed(1)} thousand USDC`;
    }
  } else {
    return `${value.toLocaleString()} USDC`;
  }
}

// Main execution
if (require.main === module) {
  fetchTVLLimit()
    .then((result) => {
      console.log('\nTVL Limit fetched successfully:');
      console.log(JSON.stringify(result, null, 2));
      process.exit(0);
    })
    .catch((error) => {
      console.error('Failed to fetch TVL limit:', error);
      process.exit(1);
    });
}

module.exports = { fetchTVLLimit, formatTVLLimit };
