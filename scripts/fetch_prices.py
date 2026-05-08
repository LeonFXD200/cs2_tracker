import json
import time
import urllib.request
import sys
import os

# Steam Community Market search — public API, no auth needed
STEAM_URL = (
    'https://steamcommunity.com/market/search/render/'
    '?appid=730&norender=1&count=100&sort_column=popular&sort_dir=desc&start={start}'
)

HEADERS = {
    'User-Agent': (
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) '
        'AppleWebKit/537.36 (KHTML, like Gecko) '
        'Chrome/120.0.0.0 Safari/537.36'
    ),
    'Accept': '*/*',
    'Accept-Language': 'en-US,en;q=0.9',
}

MAX_PAGES = 8   # 800 items max — plenty for the tracker


def fetch_steam():
    all_items = []
    for page in range(MAX_PAGES):
        start = page * 100
        url = STEAM_URL.format(start=start)
        print(f'Fetching page {page + 1} (start={start})…')
        try:
            req = urllib.request.Request(url, headers=HEADERS)
            with urllib.request.urlopen(req, timeout=30) as resp:
                data = json.loads(resp.read())

            results = data.get('results', [])
            if not results:
                print('No more results, stopping.')
                break

            for item in results:
                price_cents = item.get('sell_price', 0)
                if price_cents <= 0:
                    continue
                price = round(price_cents / 100, 2)
                all_items.append({
                    'market_hash_name': item.get('hash_name', ''),
                    'currency': 'USD',
                    'suggested_price': price,
                    'min_price': price,
                    'max_price': price,
                    'mean_price': price,
                    'quantity': max(1, item.get('sell_listings', 1)),
                })

            print(f'  → {len(results)} items (total so far: {len(all_items)})')

            if len(results) < 100:
                break

            time.sleep(1)  # be polite to Steam

        except Exception as e:
            print(f'  Page {page + 1} failed: {e}', file=sys.stderr)
            if all_items:
                break   # use what we have
            raise

    return all_items


if __name__ == '__main__':
    os.makedirs('data', exist_ok=True)

    try:
        result = fetch_steam()
    except Exception as e:
        print(f'ERROR: Steam fetch failed: {e}', file=sys.stderr)
        sys.exit(1)

    if not result:
        print('ERROR: no items fetched', file=sys.stderr)
        sys.exit(1)

    out_path = 'data/prices.json'
    with open(out_path, 'w', encoding='utf-8') as f:
        json.dump(result, f)

    print(f'Done — wrote {len(result)} items to {out_path}')
