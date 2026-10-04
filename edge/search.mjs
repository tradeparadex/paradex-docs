// Full-text search over /_mcp/search-index.json for the MCP searchDocs tool.
//
// The index is written by the build (one entry per page, one section per H2/H3
// plus the page intro). This module turns it into an in-memory inverted index
// once per isolate and ranks sections with BM25F: matches in the page title,
// the section heading and the breadcrumbs count more than matches in the body
// text, and sections that match every query word rank above sections that
// match only some of them.
//
// Tokens keep identifiers searchable: "BTC-USD-PERP", "get/orders" and
// "market_symbol" are indexed both as their parts (btc, usd, perp) and as one
// compound token (btc_usd_perp), so an exact identifier match scores higher
// than the same words scattered across a page.
//
// Developer questions ("how do I place a limit order via the API?") get
// some help on the query side: question filler words are stopwords, a word
// also matches its -ing/-ed/-ion forms and a few API verb synonyms at a
// lower weight, a page whose title is made of the query's words ranks up,
// "what is X" prefers a "What is/are X" section, and release notes rank a
// little below the pages they describe.

const PART_SPLIT_RE = /[-_./:]+/;
const MAX_COMPOUND_PARTS = 4;

const STOPWORDS = new Set(
  (
    'a an and are as at be been but by can could did do does for from had has have how i if in into is it its ' +
    'me my no of on or our should so than that the their them then there these they this those to was we were ' +
    'what when where which who whom why will with would you your ' +
    // Filler words of questions ("how does X work", "when does X happen").
    'about also any happen happens happened mean means need needs please via want way work works'
  ).split(' '),
);

// BM25F parameters and field weights.
const K1 = 1.2;
const B = 0.75;
const W_HEADING = 2.5;
const W_TITLE = 3;
const W_CRUMB = 0.75;
const W_COMPOUND = 1.5;
const W_PREFIX = 0.6;
const W_VARIANT = 0.6;
const W_SYNONYM = 0.5;
const W_CHANGELOG = 0.8;
const TITLE_MATCH_BOOST = 0.6;
const MAX_PREFIX_EXPANSIONS = 24;
const MAX_RESULTS_PER_PAGE = 2;
const SNIPPET_LENGTH = 240;
const CACHE_LIMIT = 100000;
const PHRASE_CANDIDATES = 200;
const DEFINITION_BOOST = 1.6;
// Query bounds: searchDocs takes any string, and every distinct query word
// costs memory per matching section, so a long query is cut down first.
const MAX_QUERY_LENGTH = 2048;
const MAX_QUERY_TERMS = 48;

/** Light English plural stemmer (Porter step 1a, plus -xes/-ches/-shes). */
export function stem(word) {
  if (word.length <= 3 || /\d/.test(word)) return word;
  if (word.endsWith('sses')) return word.slice(0, -2);
  if (word.endsWith('ies')) return word.length > 4 ? `${word.slice(0, -3)}y` : word;
  if (word.endsWith('xes') || word.endsWith('ches') || word.endsWith('shes')) return word.slice(0, -2);
  if (word.endsWith('ss') || word.endsWith('us') || word.endsWith('is')) return word;
  if (word.endsWith('s')) return word.slice(0, -1);
  return word;
}

// Query-side word forms: a query word also matches its -ing / -ed / -ion /
// -er relatives that occur in the index ("place" finds "placing" and
// "placed", "liquidate" finds "liquidation"), at a lower weight. The index
// itself only folds plurals, so an exact word ("funding") still outranks a
// related form ("fund").
const DERIVED_SUFFIXES = ['ing', 'ed', 'ion', 'er'];
const STRIPPED_SUFFIXES = ['ings', 'ing', 'ions', 'ion', 'ers', 'er', 'ed'];

function wordForms(word) {
  if (word.length < 4 || /\d/.test(word)) return [];
  const bases = new Set([word]);
  for (const suffix of STRIPPED_SUFFIXES) {
    if (word.length > suffix.length + 2 && word.endsWith(suffix)) {
      const base = word.slice(0, -suffix.length);
      bases.add(base);
      bases.add(`${base}e`);
      if (/([b-df-hj-np-tv-z])\1$/.test(base)) bases.add(base.slice(0, -1)); // stopped -> stop
    }
  }
  if (word.endsWith('e')) bases.add(word.slice(0, -1));
  const forms = new Set();
  for (const base of bases) {
    forms.add(stem(base));
    for (const suffix of DERIVED_SUFFIXES) forms.add(stem(base + suffix));
    if (/[aeiou][b-df-hj-np-tv-z]$/.test(base)) {
      for (const suffix of ['ing', 'ed']) forms.add(stem(base + base[base.length - 1] + suffix));
    }
  }
  forms.delete(stem(word));
  return [...forms];
}

// Query-side synonyms for the verbs developers use about API operations
// ("place an order" is the "Create order" endpoint).
const SYNONYMS = new Map(
  Object.entries({
    place: ['create', 'submit'],
    submit: ['create', 'place'],
    cancel: ['delete'],
    delete: ['cancel', 'remove'],
    remove: ['cancel', 'delete'],
    fetch: ['get', 'list'],
    retrieve: ['get', 'list'],
    get: ['list'],
    list: ['get'],
    ws: ['websocket'],
    subscribe: ['channel', 'receive'],
    // Paradex's vaults are called VTFs in the docs.
    vault: ['vtf'],
    vtf: ['vault'],
  }),
);

function keepPart(part) {
  if (STOPWORDS.has(part)) return false;
  // Single letters carry no meaning ("paradex's" -> "s"); single digits do.
  return part.length > 1 || (part >= '0' && part <= '9');
}

function splitParts(word) {
  return word.split(PART_SPLIT_RE).filter(Boolean);
}

// word (a regex match) -> the index terms it produces. Words repeat a lot, so
// caching makes tokenizing the whole index several times faster.
const wordCache = new Map();

function termsForWord(word) {
  let terms = wordCache.get(word);
  if (terms !== undefined) return terms;
  terms = [];
  const parts = splitParts(word);
  for (const part of parts) if (keepPart(part)) terms.push(stem(part));
  if (parts.length > 1 && parts.length <= MAX_COMPOUND_PARTS) {
    terms.push(parts.join('_'));
    // "sub-accounts" is also found as "subaccounts".
    if (parts.every((p) => /^[a-z]+$/.test(p))) terms.push(stem(parts.join('')));
  }
  if (wordCache.size < CACHE_LIMIT) wordCache.set(word, terms);
  return terms;
}

function isWordCode(c) {
  return (c >= 97 && c <= 122) || (c >= 48 && c <= 57) || (c >= 0xc0 && c <= 0x24f);
}

function isSeparatorCode(c) {
  // - _ . / :
  return c === 45 || c === 95 || c === 46 || c === 47 || c === 58;
}

/**
 * Calls `fn` for every word of lowercased text. A word is a run of letters and
 * digits, joined by single separators (-_./:) into compounds such as
 * "btc-usd-perp", "get/orders" or "market_symbol". Hand-written because it is
 * several times faster than the equivalent regex over the whole index.
 */
function forEachWord(lower, fn) {
  const n = lower.length;
  let i = 0;
  while (i < n) {
    if (!isWordCode(lower.charCodeAt(i))) {
      i++;
      continue;
    }
    const start = i++;
    while (i < n) {
      const c = lower.charCodeAt(i);
      if (isWordCode(c)) i++;
      else if (isSeparatorCode(c) && i + 1 < n && isWordCode(lower.charCodeAt(i + 1))) i += 2;
      else break;
    }
    fn(lower.slice(start, i));
  }
}

/**
 * Splits text into index terms: stemmed words, with each identifier such as
 * "btc-usd-perp" giving its parts plus a compound term ("btc_usd_perp") and,
 * for all-letter compounds, the joined word ("sub-accounts" -> "subaccount").
 */
export function tokenize(text) {
  const out = [];
  if (!text) return out;
  forEachWord(String(text).toLowerCase(), (word) => {
    const terms = termsForWord(word);
    for (let i = 0; i < terms.length; i++) out.push(terms[i]);
  });
  return out;
}

/**
 * The plain (non-compound) terms of a title: "Cancel all open orders" ->
 * cancel, all, open, order. Channel placeholders are left out
 * ("fills.{market_symbol}" -> fill).
 */
function titleParts(text) {
  const out = [];
  if (!text) return out;
  forEachWord(String(text).toLowerCase().replace(/\{[^}]*\}/g, ' '), (word) => {
    for (const part of splitParts(word)) if (keepPart(part)) out.push(stem(part));
  });
  return out;
}

/** Builds the in-memory index from the parsed search-index.json document. */
export function buildSearchIndex(data) {
  if (!data || !Array.isArray(data.pages) || !Array.isArray(data.sections)) {
    throw new Error('Search index is malformed');
  }
  const pages = data.pages;
  const sections = data.sections.filter(
    (s) => s && Number.isInteger(s.page) && s.page >= 0 && s.page < pages.length,
  );
  const N = sections.length;

  const termIds = new Map();
  const sectionPostings = []; // id -> [section, tfText, tfHeading, ...]
  const pagePostings = []; // id -> [page, tfTitle, tfCrumb, ...]
  const df = []; // id -> number of sections with the term in any field
  const lastSeen = []; // id -> last section counted in df
  const idOf = (term) => {
    let id = termIds.get(term);
    if (id === undefined) {
      id = termIds.size;
      termIds.set(term, id);
      sectionPostings.push(null);
      pagePostings.push(null);
      df.push(0);
      lastSeen.push(-1);
    }
    return id;
  };

  // Reusable per-document counters.
  let countA = new Int32Array(1024);
  let countB = new Int32Array(1024);
  const touched = [];
  const grow = (id) => {
    if (id < countA.length) return;
    let size = countA.length;
    while (size <= id) size *= 2;
    const a = new Int32Array(size);
    a.set(countA);
    countA = a;
    const b = new Int32Array(size);
    b.set(countB);
    countB = b;
  };
  const add = (terms, counts) => {
    for (const term of terms) {
      const id = idOf(term);
      grow(id);
      const c = counts === 0 ? countA : countB;
      if (countA[id] === 0 && countB[id] === 0) touched.push(id);
      c[id]++;
    }
  };
  const flush = (postings, doc) => {
    for (const id of touched) {
      let list = postings[id];
      if (list === null) postings[id] = list = [];
      list.push(doc, countA[id], countB[id]);
      countA[id] = 0;
      countB[id] = 0;
    }
    touched.length = 0;
  };

  const pageTermIds = new Array(pages.length);
  const pageTitleTerms = new Array(pages.length);
  pages.forEach((page, p) => {
    add(tokenize(page.title), 0);
    add(tokenize((page.breadcrumbs ?? []).join(' ')), 1);
    pageTermIds[p] = touched.slice();
    pageTitleTerms[p] = [...new Set(titleParts(page.title).map((term) => termIds.get(term)))];
    flush(pagePostings, p);
  });

  const textLength = new Float64Array(N);
  const pageSections = pages.map(() => []);
  let totalLength = 0;
  sections.forEach((section, i) => {
    pageSections[section.page].push(i);
    const textTerms = tokenize(section.text);
    textLength[i] = textTerms.length;
    totalLength += textTerms.length;
    add(textTerms, 0);
    add(tokenize(section.heading), 1);
    for (const id of touched) {
      lastSeen[id] = i;
      df[id]++;
    }
    for (const id of pageTermIds[section.page]) {
      if (lastSeen[id] === i) continue;
      lastSeen[id] = i;
      df[id]++;
    }
    flush(sectionPostings, i);
  });

  return {
    pages,
    sections,
    N,
    avgLength: N > 0 && totalLength > 0 ? totalLength / N : 1,
    textLength,
    pageSections,
    pageTitleTerms,
    termIds,
    sectionPostings,
    pagePostings,
    df,
  };
}

function idf(index, id) {
  const n = index.df[id];
  return Math.log(1 + (index.N - n + 0.5) / (n + 0.5));
}

function prefixExpansions(index, prefix, exclude) {
  const found = [];
  for (const [term, id] of index.termIds) {
    if (term !== exclude && term.startsWith(prefix) && !term.includes('_')) found.push(id);
  }
  // Prefer the most common completions.
  found.sort((a, b) => index.df[b] - index.df[a]);
  return found.slice(0, MAX_PREFIX_EXPANSIONS);
}

/**
 * Turns a query into weighted terms. Each content word is a "group" that a
 * section either matches or not (used for coverage); compound terms only add
 * score. The last word also matches as a prefix ("liquid" -> "liquidation").
 */
function analyzeQuery(index, query) {
  const groups = []; // [{raw, terms: [{id, weight}]}]
  const bonus = new Set(); // compound term ids
  const rawWords = new Set();
  const seen = new Set();
  forEachWord(boundedQuery(query).toLowerCase(), (word) => {
    if (groups.length >= MAX_QUERY_TERMS) return;
    const parts = splitParts(word);
    for (const part of parts) {
      if (!keepPart(part)) continue;
      const term = stem(part);
      if (rawWords.size < MAX_QUERY_TERMS) rawWords.add(part);
      if (seen.has(term) || groups.length >= MAX_QUERY_TERMS) continue;
      seen.add(term);
      const id = index.termIds.get(term);
      const group = { raw: part, term, terms: id === undefined ? [] : [{ id, weight: 1 }] };
      const addTerm = (t, weight) => {
        const tid = index.termIds.get(t);
        if (tid !== undefined && !group.terms.some((x) => x.id === tid)) group.terms.push({ id: tid, weight });
      };
      for (const form of wordForms(term)) addTerm(form, W_VARIANT);
      for (const synonym of SYNONYMS.get(part) ?? SYNONYMS.get(term) ?? []) addTerm(stem(synonym), W_SYNONYM);
      groups.push(group);
    }
    if (parts.length > 1 && parts.length <= MAX_COMPOUND_PARTS) {
      for (const term of [parts.join('_'), stem(parts.join(''))]) {
        const id = index.termIds.get(term);
        if (id !== undefined) bonus.add(id);
      }
    }
  });
  const last = groups[groups.length - 1];
  if (last && last.raw.length >= 3 && !/\d/.test(last.raw)) {
    for (const id of prefixExpansions(index, last.raw, last.term)) last.terms.push({ id, weight: W_PREFIX });
  }
  return { groups, bonus: [...bonus], rawWords: [...rawWords] };
}

/** A "What is/are ..." heading that contains one of the query's words. */
function isDefinitionHeading(heading, groups) {
  const words = normalizePhrase(heading).split(' ');
  if (words[0] !== 'what' || !['is', 'are', 's'].includes(words[1])) return false;
  const terms = new Set(words.slice(2).map((word) => stem(word)));
  return groups.some((group) => terms.has(group.term));
}

/** The query as searched: at most MAX_QUERY_LENGTH characters. */
function boundedQuery(query) {
  const text = String(query ?? '');
  return text.length > MAX_QUERY_LENGTH ? text.slice(0, MAX_QUERY_LENGTH) : text;
}

function saturate(x) {
  return (x * (K1 + 1)) / (x + K1);
}

/** Lowercase words separated by single spaces ("Sub-Accounts" -> "sub accounts"). */
function normalizePhrase(text) {
  return String(text ?? '')
    .toLowerCase()
    .replace(/[^a-z0-9\u00c0-\u024f]+/g, ' ')
    .trim();
}

/** Picks a window of the section text around the densest cluster of matches. */
export function makeSnippet(text, words, maxLength = SNIPPET_LENGTH) {
  const clean = String(text ?? '')
    .replace(/\s+/g, ' ')
    .trim();
  if (clean.length <= maxLength) return clean;
  const lower = clean.toLowerCase();
  const hits = [];
  for (const word of new Set(words)) {
    const needle = word.length > 4 ? stem(word) : word;
    let from = 0;
    while (needle && from < lower.length && hits.length < 500) {
      const at = lower.indexOf(needle, from);
      if (at < 0) break;
      if (at === 0 || !/[a-z0-9]/.test(lower[at - 1])) hits.push({ at, word });
      from = at + needle.length;
    }
  }
  let start = 0;
  if (hits.length > 0) {
    hits.sort((a, b) => a.at - b.at);
    let best = -1;
    for (let i = 0; i < hits.length; i++) {
      const covered = new Set();
      for (let j = i; j < hits.length && hits[j].at - hits[i].at < maxLength * 0.7; j++) covered.add(hits[j].word);
      if (covered.size > best) {
        best = covered.size;
        start = hits[i].at;
      }
    }
    start = Math.max(0, start - Math.floor(maxLength * 0.25));
    if (start > 0) {
      const space = clean.indexOf(' ', start);
      if (space >= 0 && space - start < 30) start = space + 1;
    }
  }
  let end = Math.min(clean.length, start + maxLength);
  if (end < clean.length) {
    const space = clean.lastIndexOf(' ', end);
    if (space > start + maxLength * 0.6) end = space;
  }
  return `${start > 0 ? '…' : ''}${clean.slice(start, end).trim()}${end < clean.length ? '…' : ''}`;
}

/**
 * Ranks sections for `query`. Returns Fern's structured search records,
 * best first: [{rank, title, url, anchor, kind, snippet, score}].
 */
export function searchIndex(index, query, topK, siteUrl) {
  const { groups, bonus, rawWords } = analyzeQuery(index, query);
  const G = groups.length;
  if (G === 0 && bonus.length === 0) return [];
  const N = index.N;
  // Per-group scores only for the sections that match something (a row of
  // G scores per candidate), so memory follows the matches, not N x G.
  const row = new Int32Array(N).fill(-1);
  const groupScores = [];
  const bonusScore = new Float64Array(N);
  const candidates = [];
  const wtf = new Float64Array(N);
  const wtfTouched = [];

  // Accumulates the BM25F weighted term frequency of one term into `wtf`.
  const frequencies = (id) => {
    const postings = index.sectionPostings[id];
    if (postings) {
      for (let i = 0; i < postings.length; i += 3) {
        const s = postings[i];
        const norm = 1 - B + (B * index.textLength[s]) / index.avgLength;
        if (wtf[s] === 0) wtfTouched.push(s);
        wtf[s] += postings[i + 1] / norm + W_HEADING * postings[i + 2];
      }
    }
    const pagePostings = index.pagePostings[id];
    if (pagePostings) {
      for (let i = 0; i < pagePostings.length; i += 3) {
        const add = W_TITLE * pagePostings[i + 1] + W_CRUMB * pagePostings[i + 2];
        for (const s of index.pageSections[pagePostings[i]]) {
          if (wtf[s] === 0) wtfTouched.push(s);
          wtf[s] += add;
        }
      }
    }
  };
  const consume = (weight, apply) => {
    for (const s of wtfTouched) {
      if (row[s] < 0) {
        row[s] = candidates.length;
        candidates.push(s);
        groupScores.push(new Float64Array(Math.max(G, 1)));
      }
      apply(s, weight * saturate(wtf[s]));
      wtf[s] = 0;
    }
    wtfTouched.length = 0;
  };

  groups.forEach((group, g) => {
    for (const { id, weight } of group.terms) {
      frequencies(id);
      consume(idf(index, id) * weight, (s, score) => {
        const scores = groupScores[row[s]];
        if (score > scores[g]) scores[g] = score;
      });
    }
  });
  for (const id of bonus) {
    frequencies(id);
    consume(idf(index, id) * W_COMPOUND, (s, score) => {
      bonusScore[s] += score;
    });
  }

  // Query group of each matched term, for the title check below.
  const groupOfTerm = new Map();
  groups.forEach((group, g) => {
    for (const { id } of group.terms) if (!groupOfTerm.has(id)) groupOfTerm.set(id, g);
  });
  // How well a page title answers the query: the share of query words the
  // title contains, times the squared share of title words that are query
  // words. 1 when they are the same words ("Liquidations" for "when does
  // liquidation happen"); small for long titles that only share a word.
  const titleCoverage = new Map();
  const coverageOf = (p) => {
    let value = titleCoverage.get(p);
    if (value !== undefined) return value;
    const terms = index.pageTitleTerms[p];
    const covered = new Set();
    let matched = 0;
    for (const id of terms) {
      const g = id === undefined ? undefined : groupOfTerm.get(id);
      if (g === undefined) continue;
      matched++;
      covered.add(g);
    }
    const titleShare = terms.length > 0 ? matched / terms.length : 0;
    value = G > 0 ? (covered.size / G) * titleShare * titleShare : 0;
    titleCoverage.set(p, value);
    return value;
  };

  const scored = [];
  for (const s of candidates) {
    let matched = 0;
    let base = bonusScore[s];
    const scores = groupScores[row[s]];
    for (let g = 0; g < G; g++) {
      const v = scores[g];
      if (v > 0) matched++;
      base += v;
    }
    if (base <= 0) continue;
    const coverage = G > 0 ? matched / G : 1;
    let score = base * (0.3 + 0.7 * coverage * coverage);
    // The page intro is the best entry point when scores are otherwise close.
    if (index.sections[s].anchor == null) score *= 1.1;
    const p = index.sections[s].page;
    score *= 1 + TITLE_MATCH_BOOST * coverageOf(p);
    // Release notes mention everything; prefer the pages they point to.
    if (index.pages[p].kind === 'changelog') score *= W_CHANGELOG;
    scored.push({ s, score });
  }
  const byScore = (a, b) => b.score - a.score || a.s - b.s;
  scored.sort(byScore);

  // A page titled exactly like the query, and exact phrase matches, get a
  // boost. Checked on the leading candidates only, since normalizing every
  // matching section's text would dominate the cost.
  const phrase = normalizePhrase(boundedQuery(query));
  // "What is X?" asks for a definition: prefer a section headed "What is/are
  // ..." that names one of the query's words.
  const definitional = /^(what (is|are|s)|define|definition of) /.test(phrase);
  if (phrase) {
    const multiWord = phrase.includes(' ');
    const head = scored.slice(0, PHRASE_CANDIDATES);
    for (const item of head) {
      const section = index.sections[item.s];
      const title = normalizePhrase(index.pages[section.page].title);
      if (definitional && isDefinitionHeading(section.heading, groups)) item.score *= DEFINITION_BOOST;
      if (title === phrase) item.score *= 2;
      else if (!multiWord) continue;
      else if (title.includes(phrase)) item.score *= 1.5;
      else if (normalizePhrase(section.heading).includes(phrase)) item.score *= 1.35;
      else if (normalizePhrase(section.text).includes(phrase)) item.score *= 1.2;
    }
    head.sort(byScore);
    scored.splice(0, head.length, ...head);
  }

  const base = String(siteUrl ?? '').replace(/\/+$/, '');
  const perPage = new Map();
  const results = [];
  for (const { s, score } of scored) {
    if (results.length >= topK) break;
    const section = index.sections[s];
    const count = perPage.get(section.page) ?? 0;
    if (count >= MAX_RESULTS_PER_PAGE) continue;
    perPage.set(section.page, count + 1);
    const page = index.pages[section.page];
    const title = String(page.title ?? '');
    const heading = section.heading ? String(section.heading) : '';
    const path = String(page.url ?? '/');
    results.push({
      rank: results.length + 1,
      title: heading && heading !== title ? `${title} > ${heading}` : title,
      url: `${base}${path.startsWith('/') ? path : `/${path}`}`,
      anchor: section.anchor ?? null,
      kind: String(page.kind ?? 'page'),
      snippet: makeSnippet(section.text, rawWords),
      score: Math.round(score * 10000) / 10000,
    });
  }
  return results;
}
