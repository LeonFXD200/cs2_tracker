// =============================================
// api.js — CS2 price data fetcher
// Primary: GitHub-hosted JSON (CORS-safe, updated every 15 min by Actions)
// Fallbacks: CORS proxies for Skinport direct
// =============================================

const REPO_PRICES_URL = 'https://raw.githubusercontent.com/LeonFXD200/cs2_tracker/main/data/prices.json';
const SKINPORT_URL    = 'https://api.skinport.com/v1/items?app_id=730&currency=USD';

const SOURCES = [
  // 1. GitHub-hosted data — raw.githubusercontent.com always has CORS headers
  {
    build: () => REPO_PRICES_URL + '?_=' + Math.floor(Date.now() / 60000), // 1-min cache bust
    parse: data => data,
  },
  // 2. allorigins /get — wraps response in {contents: "..."}, needs JSON.parse
  {
    build: () => `https://api.allorigins.win/get?url=${encodeURIComponent(SKINPORT_URL)}`,
    parse: data => JSON.parse(data.contents),
  },
  // 3. codetabs proxy — returns raw JSON
  {
    build: () => `https://api.codetabs.com/v1/proxy?quest=${SKINPORT_URL}`,
    parse: data => data,
  },
  // 4. corsproxy.io — returns raw JSON
  {
    build: () => `https://corsproxy.io/?${encodeURIComponent(SKINPORT_URL)}`,
    parse: data => data,
  },
];

let _cache     = null;
let _cacheTime = 0;
const CACHE_MS = 60_000;

async function fetchItems(force = false) {
  if (!force && _cache && Date.now() - _cacheTime < CACHE_MS) {
    return _cache;
  }

  let lastError;

  for (const source of SOURCES) {
    const url = source.build();
    try {
      const res = await fetch(url, {
        method: 'GET',
        headers: { Accept: 'application/json' },
      });

      if (!res.ok) throw new Error(`HTTP ${res.status}`);

      const raw  = await res.json();
      const data = source.parse(raw);

      if (!Array.isArray(data)) throw new Error('Response is not an array');
      if (data.length === 0)    throw new Error('Empty prices array');

      _cache = data.filter(
        item => item.suggested_price && item.suggested_price > 0 && item.quantity > 0
      );
      _cacheTime = Date.now();
      return _cache;

    } catch (err) {
      lastError = err;
      // Try next source
    }
  }

  throw new Error(`All data sources failed. Last error: ${lastError?.message}`);
}

function clearApiCache() {
  _cache     = null;
  _cacheTime = 0;
}
