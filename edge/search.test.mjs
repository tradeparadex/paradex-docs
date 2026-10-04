import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { SEARCH_INDEX, SITE } from './fixtures.mjs';
import { buildSearchIndex, makeSnippet, searchIndex, stem, tokenize } from './search.mjs';

const index = buildSearchIndex(SEARCH_INDEX);
const search = (query, topK = 8) => searchIndex(index, query, topK, SITE);
const top = (query) => search(query)[0];

describe('tokenize', () => {
  test('keeps identifiers as parts plus compound terms', () => {
    assert.deepEqual(tokenize('BTC-USD-PERP'), ['btc', 'usd', 'perp', 'btc_usd_perp', 'btcusdperp']);
    assert.deepEqual(tokenize('GET/orders'), ['get', 'order', 'get_orders', 'getorder']);
    assert.deepEqual(tokenize('market_symbol'), ['market', 'symbol', 'market_symbol', 'marketsymbol']);
    assert.deepEqual(tokenize('/v1/orders'), ['v1', 'order', 'v1_orders']);
    assert.deepEqual(tokenize('orders.{market_symbol}'), ['order', 'market', 'symbol', 'market_symbol', 'marketsymbol']);
  });

  test('drops stopwords and single letters, stems plurals', () => {
    assert.deepEqual(tokenize("How do I cancel all of Paradex's orders?"), ['cancel', 'all', 'paradex', 'order']);
    assert.deepEqual(tokenize('fees positions addresses indexes liabilities status 2 a'), [
      'fee',
      'position',
      'address',
      'index',
      'liability',
      'status',
      '2',
    ]);
    assert.equal(stem('bus'), 'bus');
    assert.equal(stem('v1s'), 'v1s');
  });
});

describe('ranking', () => {
  test('exact identifiers', () => {
    assert.equal(top('BTC-USD-PERP').url, `${SITE}/trading/instruments-guide/futures/tier-1/btc-usd-perp`);
    assert.equal(top('btc usd perp').url, `${SITE}/trading/instruments-guide/futures/tier-1/btc-usd-perp`);
    assert.equal(top('market_symbol').url, `${SITE}/ws/web-socket-channels/orders-market-symbol/orders-market-symbol`);
    assert.equal(top('GET /v1/orders').url, `${SITE}/api/prod/orders/get-orders`);
    assert.equal(top('get/orders').url, `${SITE}/api/prod/orders/get-orders`);
  });

  test('titles outrank passing mentions', () => {
    assert.equal(top('trading fees').url, `${SITE}/trading/trading-fees`);
    assert.equal(top('sub accounts').url, `${SITE}/docs/accounts/sub-accounts`);
    assert.equal(top('rate limit').url, `${SITE}/api/general-information/rate-limits`);
    assert.equal(top('create an order').url, `${SITE}/api/prod/orders/new`);
  });

  test('section headings point at their anchor', () => {
    const result = top('maker taker fees');
    assert.equal(result.url, `${SITE}/trading/trading-fees`);
    assert.equal(result.anchor, 'maker-and-taker-fees');
    assert.equal(result.title, 'Trading Fees > Maker and taker fees');
    const api = search('instruction POST_ONLY').find((r) => r.anchor === 'request.body.instruction');
    assert.equal(api.rank, 1);
    assert.equal(api.kind, 'api');
  });

  test('the last word matches as a prefix', () => {
    assert.equal(top('liquid').url, `${SITE}/risk/liquidations`);
    assert.equal(top('subacc').url, `${SITE}/docs/accounts/sub-accounts`);
    assert.equal(top('subaccounts').url, `${SITE}/docs/accounts/sub-accounts`);
  });

  test('results are well formed', () => {
    const results = search('orders', 20);
    assert.ok(results.length > 2);
    results.forEach((r, i) => {
      assert.equal(r.rank, i + 1);
      assert.ok(r.url.startsWith(`${SITE}/`) && !r.url.includes('#'));
      assert.ok(r.anchor === null || typeof r.anchor === 'string');
      assert.ok(['page', 'api', 'changelog'].includes(r.kind));
      assert.equal(typeof r.snippet, 'string');
      assert.ok(Number.isFinite(r.score) && r.score > 0);
      if (i > 0) assert.ok(r.score <= results[i - 1].score);
    });
    // At most two sections of the same page.
    const counts = {};
    for (const r of results) counts[r.url] = (counts[r.url] ?? 0) + 1;
    assert.ok(Object.values(counts).every((n) => n <= 2));
  });

  test('topK limits the results; no match gives none', () => {
    assert.equal(search('orders', 1).length, 1);
    assert.deepEqual(search('xyzzyplugh'), []);
    assert.deepEqual(search('the of and'), []);
    assert.deepEqual(search(''), []);
  });

  test('changelog entries are searchable', () => {
    const result = top('order book snapshots');
    assert.equal(result.kind, 'changelog');
    assert.equal(result.anchor, '2025-10-16-v11169');
  });
});

describe('snippets', () => {
  test('short sections are returned whole', () => {
    assert.equal(top('liquidation').snippet, 'Liquidation happens when account value falls below maintenance margin.');
  });

  test('long sections are cut around the matches', () => {
    const snippet = top('429 too many requests').snippet;
    assert.ok(snippet.startsWith('…'));
    assert.ok(snippet.includes('HTTP 429 Too Many Requests'));
    assert.ok(snippet.length <= 245);
    const text = 'word '.repeat(100);
    assert.ok(makeSnippet(text, ['nomatch']).endsWith('…'));
  });
});

describe('developer questions', () => {
  // A small index of its own, so the shared fixture stays as it is.
  const QUESTION_INDEX = {
    version: 1,
    site: SITE,
    pages: [
      { url: '/api/prod/orders/new', title: 'Create order', kind: 'api', breadcrumbs: ['REST API', 'Orders'] },
      { url: '/api/prod/account/get-balance', title: 'List balances', kind: 'api', breadcrumbs: ['REST API', 'Account'] },
      { url: '/risk/liquidations', title: 'Liquidations', kind: 'page', breadcrumbs: ['Risk'] },
      { url: '/risk/trade-busts', title: 'Trade busts', kind: 'page', breadcrumbs: ['Risk'] },
      { url: '/releases/changelog/2025/4/2', title: 'April 2, 2025', kind: 'changelog', breadcrumbs: ['Changelog'] },
      { url: '/trading/orders/placing-orders', title: 'Placing Orders', kind: 'page', breadcrumbs: ['Trading'] },
      { url: '/ws/web-socket-channels/fills-market-symbol/fills-market-symbol', title: 'fills.{market_symbol}', kind: 'api', breadcrumbs: ['WebSocket API'] },
      { url: '/ws/web-socket-channels/subscribe/subscribe', title: 'subscribe', kind: 'api', breadcrumbs: ['WebSocket API'] },
    ],
    sections: [
      { page: 0, anchor: null, heading: null, text: 'POST /orders POST https://api.prod.paradex.trade/v1/orders Submits a new order to Paradex.' },
      { page: 1, anchor: null, heading: null, text: 'GET /balance Returns the balances of the account.' },
      { page: 2, anchor: null, heading: null, text: 'Accounts below maintenance margin are liquidated in steps.' },
      { page: 3, anchor: 'why-busts-happen', heading: 'Why busts happen', text: 'A bust can happen when a liquidation fails to fill.' },
      { page: 4, anchor: '2025-04-02-v1891', heading: 'v1.89.1', text: 'Users can now place limit orders and get the balance of the account from the order builder via the API.' },
      { page: 5, anchor: null, heading: null, text: 'Placing a limit order in the app takes three steps.' },
      { page: 6, anchor: 'receive.subscribe', heading: 'Receive', text: 'Private websocket channel to receive details of fills for the account.' },
      { page: 7, anchor: 'send.publish', heading: 'Send', text: 'subscribe Subscribe to a channel by name.' },
    ],
  };
  const questions = buildSearchIndex(QUESTION_INDEX);
  const first = (query) => searchIndex(questions, query, 8, SITE)[0].url.slice(SITE.length);

  test('question filler words are not search terms', () => {
    assert.deepEqual(tokenize('When does liquidation happen? How does it work?'), ['liquidation']);
    assert.equal(first('When does liquidation happen?'), '/risk/liquidations');
  });

  test('a page whose title is the question outranks pages that mention its words', () => {
    // "liquidated" in the text is a form of "liquidation"; the release note
    // mentions every word but ranks below the pages it is about.
    assert.equal(first('liquidation'), '/risk/liquidations');
    assert.notEqual(first('place a limit order via the API'), '/releases/changelog/2025/4/2');
  });

  test('query words match their -ing / -ed forms', () => {
    assert.equal(first('place orders steps'), '/trading/orders/placing-orders');
    assert.equal(first('liquidate accounts'), '/risk/liquidations');
  });

  test('API verbs match their synonyms', () => {
    // "place" also finds "Create order" (and "Placing Orders" through its -ing form).
    const placed = searchIndex(questions, 'place an order', 8, SITE).map((r) => r.url.slice(SITE.length));
    assert.deepEqual(placed.slice(0, 2).sort(), ['/api/prod/orders/new', '/trading/orders/placing-orders']);
    assert.equal(first('get account balance'), '/api/prod/account/get-balance');
    assert.equal(first('subscribe to fills'), '/ws/web-socket-channels/fills-market-symbol/fills-market-symbol');
  });
});

describe('definitions and domain words', () => {
  const DEFINITION_INDEX = {
    version: 1,
    site: SITE,
    pages: [
      { url: '/vtfs/introduction', title: 'Introduction', kind: 'page', breadcrumbs: ['VTFs'] },
      { url: '/vtfs/tutorials/close-your-vault', title: 'Close Your VTF', kind: 'page', breadcrumbs: ['VTFs', 'Tutorials'] },
      { url: '/api/prod/vaults/get', title: 'Get vaults', kind: 'api', breadcrumbs: ['REST API', 'Vaults'] },
    ],
    sections: [
      { page: 0, anchor: 'what-are-vtfs', heading: 'What are VTFs?', text: 'VTFs pool capital into a strategy run by a manager, so depositors share its profit and loss over time.' },
      { page: 1, anchor: 'click-close-vtf', heading: 'Click "Close VTF"', text: 'Click Close VTF.' },
      { page: 2, anchor: null, heading: null, text: 'GET /vaults Get vaults.' },
    ],
  };
  const definitions = buildSearchIndex(DEFINITION_INDEX);
  const urls = (query) => searchIndex(definitions, query, 8, SITE).map((r) => r.url.slice(SITE.length));

  test('"what is X" prefers a "What is/are X" section over a shorter mention', () => {
    assert.equal(urls('what is a VTF')[0], '/vtfs/introduction');
    // Without the question form, the short tutorial step may win.
    assert.ok(urls('VTF').includes('/vtfs/tutorials/close-your-vault'));
  });

  test('"vault" also finds VTF pages', () => {
    assert.ok(urls('vault').includes('/vtfs/introduction'));
    assert.ok(urls('VTF').includes('/api/prod/vaults/get'));
  });
});

describe('hostile queries', () => {
  test('a 100k-word query stays small and fast (words past the first 48 are ignored)', () => {
    const Original = globalThis.Float64Array;
    let biggest = 0;
    globalThis.Float64Array = class extends Original {
      constructor(n, ...rest) {
        super(n, ...rest);
        if (typeof n === 'number') biggest = Math.max(biggest, n * 8);
      }
    };
    try {
      const junk = Array.from({ length: 100000 }, (_, i) => `zq${i.toString(36)}`).join(' ');
      const started = performance.now();
      const results = search(`trading fees ${junk}`);
      const elapsed = performance.now() - started;
      assert.ok(elapsed < 500, `${elapsed} ms`);
      assert.ok(biggest < 64 * 1024, `largest Float64Array ${biggest} bytes`);
      assert.equal(results[0].url, `${SITE}/trading/trading-fees`);
      // A single huge compound word is bounded too.
      assert.ok(Array.isArray(search(Array.from({ length: 20000 }, (_, i) => `w${i}`).join('-'))));
    } finally {
      globalThis.Float64Array = Original;
    }
  });
});
