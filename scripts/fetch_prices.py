import json
import time
import urllib.request
import sys
import os

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

TARGET_ITEMS = 3000


def fetch_steam():
    all_items = []
    start = 0
    page_num = 0

    while len(all_items) < TARGET_ITEMS:
        url = STEAM_URL.format(start=start)
        print(f'Fetching start={start}…')
        try:
            req = urllib.request.Request(url, headers=HEADERS)
            with urllib.request.urlopen(req, timeout=30) as resp:
                data = json.loads(resp.read())

            results = data.get('results', [])
            pagesize = data.get('pagesize', len(results)) or 10
            total_count = data.get('total_count', 0)

            if not results:
                print('No more results, stopping.')
                break

            added = 0
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
                added += 1

            print(f'  → {added} added (total: {len(all_items)}, pagesize={pagesize}, total_count={total_count})')

            start += pagesize
            page_num += 1

            if start >= total_count:
                print('Reached end of listings.')
                break

            time.sleep(1.5)

        except Exception as e:
            print(f'  start={start} failed: {e}', file=sys.stderr)
            if all_items:
                break
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
