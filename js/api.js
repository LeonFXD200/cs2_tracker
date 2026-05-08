// =============================================
// api.js — Skinport public API (no auth needed)
// =============================================

const SKINPORT_URL = 'https://api.skinport.com/v1/items?app_id=730&currency=USD';

let _cache     = null;
let _cacheTime = 0;
const CACHE_MS = 60_000; // 1 minute in-memory cache

async function fetchItems(force = false) {
  if (!force && _cache && Date.now() - _cacheTime < CACHE_MS) {
    return _cache;
  }

  const res = await fetch(SKINPORT_URL, {
    method: 'GET',
    headers: { Accept: 'application/json' },
  });

  if (!res.ok) {
    throw new Error(`Skinport API error ${res.status}: ${res.statusText}`);
  }

  const data = await res.json();

  if (!Array.isArray(data)) {
    throw new Error('Unexpected response format from Skinport API');
  }

  // Keep only items that have a real listed price and at least 1 listing
  _cache = data.filter(
    item => item.suggested_price && item.suggested_price > 0 && item.quantity > 0
  );
  _cacheTime = Date.now();

  return _cache;
}

function clearApiCache() {
  _cache     = null;
  _cacheTime = 0;
}
