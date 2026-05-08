import json
import urllib.request
import urllib.error
import sys
import os

SOURCES = [
    'https://prices.csgotrader.app/latest/prices_v6.json',
    'https://cdn.csgotrader.app/prices/prices_v6.json',
]

SKINPORT_URL = 'https://api.skinport.com/v1/items?app_id=730&currency=USD'

HEADERS = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Accept': 'application/json',
    'Accept-Language': 'en-US,en;q=0.9',
}


def fetch_url(url):
    req = urllib.request.Request(url, headers=HEADERS)
    with urllib.request.urlopen(req, timeout=30) as resp:
        return resp.read()


def convert_csgotrader(raw):
    data = json.loads(raw)
    result = []
    for name, item in data.items():
        if not isinstance(item, dict):
            continue
        steam = item.get('steam', {})
        if not isinstance(steam, dict):
            continue
        p24  = steam.get('last_24h')
        p7d  = steam.get('last_7d')
        p30d = steam.get('last_30d')
        price = p24 or p7d or p30d
        if not price:
            continue
        try:
            result.append({
                'market_hash_name': name,
                'currency': 'USD',
                'suggested_price': round(float(price), 2),
                'price_7d':  round(float(p7d),  2) if p7d  else None,
                'price_30d': round(float(p30d), 2) if p30d else None,
                'min_price':  round(float(p7d  or price), 2),
                'max_price':  round(float(p30d or price), 2),
                'mean_price': round(float(p7d  or price), 2),
                'quantity': 1,
            })
        except (ValueError, TypeError):
            continue
    return result


def try_csgotrader():
    for url in SOURCES:
        try:
            print(f'Trying {url}')
            raw = fetch_url(url)
            result = convert_csgotrader(raw)
            if result:
                print(f'OK: {len(result)} items from {url}')
                return result
        except Exception as e:
            print(f'  failed: {e}', file=sys.stderr)
    return None


def try_skinport():
    try:
        print(f'Trying Skinport')
        raw = fetch_url(SKINPORT_URL)
        data = json.loads(raw)
        if isinstance(data, list) and data:
            print(f'OK: {len(data)} items from Skinport')
            return data
    except Exception as e:
        print(f'  Skinport failed: {e}', file=sys.stderr)
    return None


if __name__ == '__main__':
    os.makedirs('data', exist_ok=True)

    result = try_csgotrader() or try_skinport()

    if not result:
        print('ERROR: all sources failed', file=sys.stderr)
        sys.exit(1)

    out_path = 'data/prices.json'
    with open(out_path, 'w', encoding='utf-8') as f:
        json.dump(result, f)

    print(f'Written {len(result)} items to {out_path}')
