// =============================================
// api.js — Skinport public API with CORS proxy fallback
// =============================================

const SKINPORT_URL = 'https://api.skinport.com/v1/items?app_id=730&currency=USD';

// CORS proxy options tried in order
const PROXIES = [
  url => url,                                                              // 1. direct
  url => `https://api.allorigins.win/raw?url=${encodeURIComponent(url)}`, // 2. allorigins
  url => `https://corsproxy.io/?${encodeURIComponent(url)}`,              // 3. corsproxy.io
];

let _cache     = null;
let _cacheTime = 0;
const CACHE_MS = 60_000;

async function fetchItems(force = false) {
  if (!force && _cache && Date.now() - _cacheTime < CACHE_MS) {
    return _cache;
  }

  let lastError;

  for (const proxyFn of PROXIES) {
    const url = proxyFn(SKINPORT_URL);
    try {
      const res = await fetch(url, {
        method: 'GET',
        headers: { Accept: 'application/json' },
      });

      if (!res.ok) throw new Error(`HTTP ${res.status}`);

      const data = await res.json();

      if (!Array.isArray(data)) throw new Error('Unexpected response format');

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

  throw new Error(`Could not fetch market data: ${lastError?.message || 'All sources failed'}`);
}

function clearApiCache() {
  _cache     = null;
  _cacheTime = 0;
}
