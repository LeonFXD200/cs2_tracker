# CS2 Skin Market Tracker

A live CS2 skin price tracker that works like a stock market exchange — showing daily gainers, losers, price changes, and letting you set price alerts.

## Features

- **Live data** — Powered by the free [Skinport public API](https://skinport.com) (no signup, no API key)
- **Top Gainers / Losers** — See which skins are up or down the most today
- **Full Market Table** — Search, sort, and filter all tracked CS2 items
- **Price Alerts** — Set alerts for when a skin crosses your target price, with browser push notifications
- **Live Ticker** — Scrolling ticker tape of popular skins with real-time prices
- **News & Tips** — Curated links to CS2 market resources and trading tips

## How price changes work

On first load the app captures a **daily baseline** of all skin prices and saves it to `localStorage`. Every 5-minute refresh compares current prices against that baseline to show % and $ changes. The baseline resets automatically at midnight each day.

## Deploying to GitHub Pages

1. Push the folder contents to a GitHub repository
2. Go to **Settings → Pages → Source** and select `main` branch / root
3. Your site will be live at `https://yourusername.github.io/repo-name/`

## Running locally

Because the Skinport API requires CORS, open via a local server rather than `file://`:

```bash
# Python
python -m http.server 8080

# Node (npx)
npx serve .
```

Then visit `http://localhost:8080`

## Data source

All price data comes from [Skinport.com](https://skinport.com) via their free public REST API:

```
GET https://api.skinport.com/v1/items?app_id=730&currency=USD
```

Fields used: `market_hash_name`, `suggested_price`, `min_price`, `max_price`, `quantity`

## File structure

```
cs2-tracker/
├── index.html       Main page & all tabs
├── css/
│   └── style.css    Dark financial theme
├── js/
│   ├── storage.js   localStorage: baseline, alerts, history
│   ├── api.js       Skinport API fetch + caching
│   ├── alerts.js    Alert checking & browser notifications
│   └── app.js       Main controller: render, tabs, UI
└── README.md
```
