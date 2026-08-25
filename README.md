# Alertsify Flow

A gamma and options-flow analytics dashboard built with [Next.js](https://nextjs.org): live Options Flow tape, a strike-by-expiry Heat Map, Flow Map, charting with gamma trail overlays, alerts, scanner, watchlist, and backtester.

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

## Live data

Set `UNUSUAL_WHALES_API_KEY` (see `.env.local`) to pull real quotes, candles, GEX, and options flow from Unusual Whales. Without a key, every page falls back to clearly-labeled demo data — nothing generated is ever presented as live.

## Learn More

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.
