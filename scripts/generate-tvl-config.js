#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { fetchTVLLimit } = require('./fetch-tvl-limit');

async function generateTVLConfig() {
  try {
    console.log('Generating TVL configuration...');
    
    // Fetch TVL limit from contract
    const tvlData = await fetchTVLLimit();
    
    // Create config object
    const config = {
      tvlLimit: {
        rawValue: tvlData.rawValue,
        usdcValue: tvlData.usdcValue,
        formattedValue: tvlData.formattedValue,
        lastUpdated: new Date().toISOString(),
        source: 'Ethereum Contract',
        contractAddress: '0xe3cbe3a636ab6a754e9e41b12b09d09ce9e53db3'
      }
    };
    
    // Write to config file
    const configPath = path.join(__dirname, '..', 'fern', 'config', 'tvl-limit.json');
    
    // Ensure config directory exists
    const configDir = path.dirname(configPath);
    if (!fs.existsSync(configDir)) {
      fs.mkdirSync(configDir, { recursive: true });
    }
    
    fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
    
    console.log(`TVL configuration written to: ${configPath}`);
    console.log(`TVL Limit: ${tvlData.formattedValue}`);
    
    return config;
    
  } catch (error) {
    console.error('Error generating TVL config:', error);
    throw error;
  }
}

// Main execution
if (require.main === module) {
  generateTVLConfig()
    .then(() => {
      console.log('TVL configuration generated successfully');
      process.exit(0);
    })
    .catch((error) => {
      console.error('Failed to generate TVL configuration:', error);
      process.exit(1);
    });
}

module.exports = { generateTVLConfig };
