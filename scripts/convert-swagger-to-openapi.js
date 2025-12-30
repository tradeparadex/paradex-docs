#!/usr/bin/env node

/**
 * Converts Swagger 2.0 specs to OpenAPI 3.0 format
 * This fixes the #/definitions/ -> #/components/schemas/ reference issue
 */

const fs = require('fs');
const path = require('path');
const { convertFromString } = require('swagger2openapi');

async function convertSpec(filePath) {
  try {
    console.log(`Converting ${filePath} from Swagger 2.0 to OpenAPI 3.0...`);
    
    const swaggerContent = fs.readFileSync(filePath, 'utf8');
    const swaggerSpec = JSON.parse(swaggerContent);
    
    // Check if it's already OpenAPI 3.0+
    if (swaggerSpec.openapi && parseFloat(swaggerSpec.openapi) >= 3.0) {
      console.log(`  Already OpenAPI ${swaggerSpec.openapi}, skipping conversion`);
      return;
    }
    
    // Check if it's Swagger 2.0
    if (!swaggerSpec.swagger || swaggerSpec.swagger !== '2.0') {
      console.log(`  Unknown spec version, skipping conversion`);
      return;
    }
    
    // Convert Swagger 2.0 to OpenAPI 3.0
    const options = {
      patch: true,
      warnOnly: true,
    };
    
    const result = await convertFromString(swaggerContent, options);
    const openapiSpec = result.openapi;
    
    // Write back the converted spec
    fs.writeFileSync(filePath, JSON.stringify(openapiSpec, null, 2), 'utf8');
    console.log(`  ✓ Successfully converted to OpenAPI ${openapiSpec.openapi}`);
    
  } catch (error) {
    console.error(`  ✗ Error converting ${filePath}:`, error.message);
    process.exit(1);
  }
}

async function main() {
  const specs = [
    'fern/apis/prod_rest/openapi/openapi.json',
    'fern/apis/testnet_rest/openapi/openapi.json',
  ];
  
  for (const spec of specs) {
    const filePath = path.join(process.cwd(), spec);
    if (fs.existsSync(filePath)) {
      await convertSpec(filePath);
    } else {
      console.log(`  ⚠ File not found: ${filePath}`);
    }
  }
}

main().catch(error => {
  console.error('Conversion failed:', error);
  process.exit(1);
});


