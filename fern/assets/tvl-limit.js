/**
 * Fetches and displays the TVL limit from the Ethereum smart contract.
 * Only runs when an element with id="tvl-limit-value" exists on the page.
 *
 * Contract: 0xe3cbe3a636ab6a754e9e41b12b09d09ce9e53db3
 * Method: getMaxTotalBalance(address token)
 * Token: 0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48 (USDC)
 */
(function () {
  const CONTRACT_ADDRESS = '0xe3cbe3a636ab6a754e9e41b12b09d09ce9e53db3';
  const USDC_ADDRESS = '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48';
  const USDC_DECIMALS = 6;
  const FUNCTION_SELECTOR = '0x4baf43da';

  const paddedAddress = USDC_ADDRESS.slice(2).toLowerCase().padStart(64, '0');
  const callData = FUNCTION_SELECTOR + paddedAddress;

  let cachedTvlUsdc = null;

  async function fetchTVLLimit() {
    if (cachedTvlUsdc !== null) {
      return cachedTvlUsdc;
    }

    try {
      const response = await fetch('https://eth.llamarpc.com', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jsonrpc: '2.0',
          method: 'eth_call',
          params: [{ to: CONTRACT_ADDRESS, data: callData }, 'latest'],
          id: 1,
        }),
      });

      const data = await response.json();
      if (data.error) {
        return null;
      }

      const tvlWei = BigInt(data.result);
      cachedTvlUsdc = Number(tvlWei) / Math.pow(10, USDC_DECIMALS);
      return cachedTvlUsdc;
    } catch (error) {
      return null;
    }
  }

  function formatNumber(num) {
    if (num >= 1_000_000) {
      return (num / 1_000_000).toFixed(0) + ' million';
    } else if (num >= 1_000) {
      return (num / 1_000).toFixed(0) + ',000';
    }
    return num.toLocaleString();
  }

  async function updateTVLDisplay() {
    const tvlElement = document.getElementById('tvl-limit-value');
    if (!tvlElement || tvlElement.dataset.updated === 'true') {
      return;
    }

    const tvlUsdc = await fetchTVLLimit();
    if (tvlUsdc !== null) {
      tvlElement.textContent = formatNumber(tvlUsdc) + ' USDC across all users';
      tvlElement.dataset.updated = 'true';
    }
  }

  // Watch for the element to appear (handles client-side navigation)
  const observer = new MutationObserver(updateTVLDisplay);
  observer.observe(document.body, { childList: true, subtree: true });

  updateTVLDisplay();
})();
