/**
 * Fetches and displays the TVL limit from the Ethereum smart contract.
 * Only runs when an element with id="tvl-limit-value" exists on the page.
 *
 * Contract: 0xe3cbe3a636ab6a754e9e41b12b09d09ce9e53db3
 * Method: getMaxTotalBalance(address token)
 * Token: 0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48 (USDC)
 */
import type {ClientModule} from '@docusaurus/types';

const CONTRACT_ADDRESS = '0xe3cbe3a636ab6a754e9e41b12b09d09ce9e53db3';
const USDC_ADDRESS = '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48';
const USDC_DECIMALS = 6;
const FUNCTION_SELECTOR = '0x4baf43da';

const callData = FUNCTION_SELECTOR + USDC_ADDRESS.slice(2).toLowerCase().padStart(64, '0');

let cachedTvlUsdc: number | null = null;

async function fetchTvlLimit(): Promise<number | null> {
  if (cachedTvlUsdc !== null) return cachedTvlUsdc;
  try {
    const response = await fetch('https://eth.llamarpc.com', {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({
        jsonrpc: '2.0',
        method: 'eth_call',
        params: [{to: CONTRACT_ADDRESS, data: callData}, 'latest'],
        id: 1,
      }),
    });
    const data = await response.json();
    if (data.error) return null;
    cachedTvlUsdc = Number(BigInt(data.result)) / 10 ** USDC_DECIMALS;
    return cachedTvlUsdc;
  } catch {
    return null;
  }
}

function formatNumber(num: number): string {
  if (num >= 1_000_000) return `${(num / 1_000_000).toFixed(0)} million`;
  if (num >= 1_000) return `${(num / 1_000).toFixed(0)},000`;
  return num.toLocaleString();
}

async function updateTvlDisplay() {
  const element = document.getElementById('tvl-limit-value');
  if (!element || element.dataset.updated === 'true') return;
  const tvlUsdc = await fetchTvlLimit();
  if (tvlUsdc !== null) {
    element.textContent = `${formatNumber(tvlUsdc)} USDC across all users`;
    element.dataset.updated = 'true';
  }
}

const clientModule: ClientModule = {
  onRouteDidUpdate() {
    void updateTvlDisplay();
  },
};

export default clientModule;
