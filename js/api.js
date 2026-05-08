// =============================================
// api.js — Skinport public API with CORS proxy fallback
// =============================================

const SKINPORT_URL = 'https://api.skinport.com/v1/items?app_id=730&currency=USD';

// Each proxy has its own URL builder and response parser.
// allorigins /get wraps the response in {contents:"[...]"} — needs JSON.parse on contents.
// Other proxies return the raw JSON array directly.
const PROXY_CONFIGS = [
  {
    build: url => url,
    parse: data => data,
  },
  {
    build: url => `https://api.allorigins.win/get?url=${encodeURIComponent(url)}`,
    parse: data => JSON.parse(data.contents),
  },
  {
    build: url => `https://api.codetabs.com/v1/proxy?quest=${url}`,
    parse: data => data,
  },
  {
    build: url => `https://corsproxy.io/?${encodeURIComponent(url)}`,
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

  for (const config of PROXY_CONFIGS) {
    const url = config.build(SKINPORT_URL);
    try {
      const res = await fetch(url, {
        method: 'GET',
        headers: { Accept: 'application/json' },
      });

      if (!res.ok) throw new Error(`HTTP ${res.status}`);

      const raw  = await res.json();
      const data = config.parse(raw);

      if (!Array.isArray(data)) throw new Error('Response is not an array');

      _cache = data.filter(
        item => item.suggested_price && item.suggested_price > 0 && item.quantity > 0
      );
      _cacheTime = Date.now();
      return _cache;

    } catch (err) {
      lastError = err;
      // Try next proxy
    }
  }

  throw new Error(`Could not fetch market data — all sources failed. Last error: ${lastError?.message}`);
}

function clearApiCache() {
  _cache     = null;
  _cacheTime = 0;
}
