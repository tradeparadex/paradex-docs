#!/usr/bin/env node
// Pulls the latest REST API specs from the running API and writes them to
// docs/apis/<api>/openapi/openapi.json. Swagger 2.0 responses are converted
// to OpenAPI 3. The hand-written docs additions in overrides.yml are left
// untouched; they are merged in at build time.
//
// Replaces the fern-api/sync-openapi GitHub Action.
//
// Usage: node scripts/sync-openapi.mjs [prod_rest|testnet_rest ...]

import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createRequire} from 'node:module';

const require = createRequire(import.meta.url);
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

export const ORIGINS = {
  prod_rest: 'https://api.prod.paradex.trade/swagger/doc.json',
  testnet_rest: 'https://api.testnet.paradex.trade/swagger/doc.json',
};

async function toOpenApi3(spec) {
  if (spec.openapi) return spec;
  if (spec.swagger !== '2.0') throw new Error('Unknown spec format (expected Swagger 2.0 or OpenAPI 3)');
  const {convertObj} = require('swagger2openapi');
  const {openapi} = await convertObj(spec, {patch: true, warnOnly: true});
  return openapi;
}

async function sync(api) {
  const url = ORIGINS[api];
  if (!url) throw new Error(`No origin configured for ${api}`);
  const response = await fetch(url);
  if (!response.ok) throw new Error(`${url}: HTTP ${response.status}`);
  const spec = await toOpenApi3(await response.json());
  const file = path.join(root, 'docs', 'apis', api, 'openapi', 'openapi.json');
  const next = JSON.stringify(spec, null, 2) + '\n';
  const previous = fs.existsSync(file) ? fs.readFileSync(file, 'utf8') : '';
  if (previous.trim() === next.trim()) {
    console.log(`${api}: up to date`);
    return false;
  }
  fs.writeFileSync(file, next);
  console.log(`${api}: updated ${path.relative(root, file)}`);
  return true;
}

const apis = process.argv.slice(2).length ? process.argv.slice(2) : Object.keys(ORIGINS);
let failed = false;
for (const api of apis) {
  try {
    await sync(api);
  } catch (error) {
    failed = true;
    console.error(`${api}: ${error.message}`);
  }
}
process.exit(failed ? 1 : 0);
