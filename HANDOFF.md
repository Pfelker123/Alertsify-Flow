# Alertsify Flow — Dev Handoff

Options-flow / gamma-analytics trading dashboard. Rebranded from an earlier
"Flowster" prototype — user-facing text says Alertsify Flow everywhere, but
several internal identifiers were deliberately left as `Flowsters*` (see
"Known naming inconsistencies" below).

## Stack

- Next.js 16 (App Router), React 19, TypeScript
- Tailwind v4 (CSS-variable theme in `app/globals.css`, `oklch color-mix()`
  for tinting — no `tailwind.config` file, tokens are declared in `@theme`)
- SWR for client-side data fetching (`lib/uw/hooks.ts`)
- `lightweight-charts` for the price chart
- No test suite exists yet.
- `next.config.mjs` sets `typescript: { ignoreBuildErrors: true }` — `next
  build` will succeed even with type errors. There are ~4 pre-existing
  `string | null` errors in `instrument-bar.tsx` / `filter-bar.tsx` /
  `settings-panels.tsx`, unrelated to recent work, never cleaned up.

## Branches

- `main` — what Vercel deploys from.
- `claude/alertsify-flow-visualizations-blt338` — the working branch used
  this session. **Keep these two in sync** (same commit SHA) — the pattern
  used all session was: commit on whichever branch is checked out, push it,
  then `git checkout <other>`, `git merge <first> --ff-only`, push again.
  Don't let them diverge.

## Environment

- `UNUSUAL_WHALES_API_KEY` — required for live data. Set locally in
  `.env.local` (gitignored, never commit it) and in Vercel → Project
  Settings → Environment Variables (all three environments: Production,
  Preview, Development). A redeploy is required after changing it.
- `FLOWSTERS_DEMO_MODE=true` — forces demo/mock envelopes even if a key is
  set (see `lib/market/types.ts:isDemoMode`). Should be unset/false in
  production.
- **This sandbox has no network egress to `unusualwhales.com` or
  `api.unusualwhales.com`** (org proxy policy — confirmed via both `curl`
  and the harness's `WebFetch` tool, both return a hard block before
  reaching UW's servers). Nothing about the code can fix this; it means any
  live-data work done in a Claude Code cloud/remote sandbox can be written
  and reviewed but **not verified end-to-end** here. Verification has to
  happen on a deploy with real egress (Vercel) or on the user's own machine.

## Data architecture — two parallel systems (both real, both load-bearing)

This is the single most important thing to understand before touching data
code — it's easy to "fix" one path and not realize the other exists.

1. **`lib/uw/service.ts` + `lib/uw/client.ts`** — simpler, older path.
   `fetchX()` functions each try a live UW call and `catch` to a
   `mockX()`/`mockTicker()` etc. fallback, exposing a plain `live: boolean`
   flag. Powers: Options Flow, Heat Map, GEX board, quotes/ticker tape,
   candles, alerts, symbol search. Routes in `app/api/uw/*`.
2. **`lib/uw/live-source.ts` + `lib/analytics/*`** — the more rigorous
   path, built around a `DataEnvelope` with three states: `unavailable` /
   `demo` / `live` (see `lib/market/types.ts`). Principle baked in:
   **never present a generated value as live**. Powers the Dashboard's
   analytics endpoint (`app/api/uw/analytics/[symbol]/route.ts`) and the
   `Level`/node engine (attraction, reversal, walls, gamma flip).

Both call the same `uwFetch()` in `lib/uw/client.ts`, which:
- Adds `Authorization: Bearer <key>` and a hardcoded header
  `UW-CLIENT-API-ID: 100001` — **verify this ID is actually meant to be a
  static literal**; it looks like it may have been copied from an example
  and never parameterized. Worth double-checking against UW's docs once
  they're reachable.
- Unwraps UW's `{ data: ... }` response envelope automatically.
- Throws a typed `UWError` (with `status`, and `retryAfter` on 429) that
  every caller catches to trigger its mock fallback.

### UW endpoints currently wired up

All under `https://api.unusualwhales.com`, all stock/equity-style paths:

| Endpoint | Used for |
|---|---|
| `/api/stock/{sym}/stock-state` | Quote (price, change) — **suspected broken for index tickers, see bug below** |
| `/api/stock/{sym}/ohlc/{size}` | Candles |
| `/api/stock/{sym}/greek-exposure/strike` | GEX board (strike-only grid) |
| `/api/stock/{sym}/greek-exposure/strike-expiry` | Heat Map (strike × expiry grid) |
| `/api/stock/{sym}/greek-exposure` | Aggregate greek exposure (flow summary) |
| `/api/stock/{sym}/options-volume` | Options volume |
| `/api/stock/{sym}/net-prem-ticks` | Net premium ticks |
| `/api/stock/{sym}/interpolated-iv` | ATM IV |
| `/api/stock/{sym}/option/volume-oi-expiry` | Expiry list / DTE breakdown |
| `/api/stock/{sym}/expiry-breakdown` | Expiry breakdown (analytics path) |
| `/api/stock/{sym}/option-contracts` | Contract-level rows (analytics path) |
| `/api/stock/{sym}/info` | Symbol search / instrument metadata |
| `/api/option-trades/flow-alerts` | Options Flow tape + Alerts feed |

Not wired to any dedicated endpoint yet: **Scanner** (reuses the Alerts
flow-alerts feed rather than a real screener), **Backtester** (fully
client-side simulation by design — there's no "live" version of a backtest).

## Known open issues

1. **SPX (and likely other cash indices) shows stale mock data even with a
   working key.** User confirmed on a real Vercel deploy: SPX displayed
   ~5850 (the hardcoded mock in `lib/mock-data.ts:58`,
   `{ symbol: 'SPX', price: 5854.2 }`) instead of the real ~7712. Root
   cause almost certainly: `fetchQuote()` in `lib/uw/service.ts` calls
   `/api/stock/{sym}/stock-state` for every symbol including SPX, and that
   endpoint is built for tradable stocks/ETFs with a last-traded price — a
   cash index likely isn't served the same way (or needs a different
   ticker convention). **Needs the actual Vercel runtime log line for the
   SPX request to confirm** (404 vs wrong-format vs something else) before
   writing a real fix — do not guess-patch this blind.
2. Same root-cause class may affect other index tickers in
   `TAPE_SYMBOLS`/`FLOW_UNIVERSE` (check `lib/mock-data.ts`) — anything
   that isn't a normal optionable stock/ETF.
3. Scanner has no dedicated screener endpoint (see above) — currently just
   redisplays the Alerts feed.
4. `UW-CLIENT-API-ID: 100001` in `lib/uw/client.ts` — unverified whether
   this is correct/required or a leftover placeholder.

## Heat Map board (`components/heatmap/gamma-heatmap.tsx`)

This was the main focus of recent work and is now the **only** strike ×
expiry board in the app (the old standalone `/flow-map` page and
`components/dashboard/gex-board.tsx` were deleted and redirect to
`/heatmap`; `components/dashboard/gamma-map.tsx` is a separate, smaller
widget embedded on the Dashboard — it shares color tokens but is not the
same component).

Current color system (all CSS vars in `app/globals.css`, "Trading
semantics" section):

| Concept | Token | Value | Notes |
|---|---|---|---|
| Positive gamma / support | `--bull` | `#3fd08a` | also used generically for "up" |
| Negative gamma / fuel | `--bear` | `#f0625e` | also generic "down" |
| Attraction (pin/magnet level) | `--attraction` | `#12e8a0` | same hex as `--brand-green` (the logo color) — intentional, per explicit user request |
| Spot / Gamma Flip (share one token) | `--spot` | `#38bdf8` | light blue — Spot and Flip are visually distinguished only by icon/label, not color |
| Reversal risk | `--reversal` | `#e877d6` | pink/magenta — chosen as the "5th" distinct color once green/red/blue/black were all spoken for; do **not** make this a bull/bear (buy/sell) split again, that was tried and reverted because it collided with green gamma cells once Attraction also went green |
| Grower (today's dominant/most-growing flow strike, formerly called "Surge") | `--grower` | `#f5a623` | amber — added specifically to stop it reading the same as Attraction's green |
| Board background | n/a | `bg-black` (Tailwind literal, not a CSS var) | scoped to the actual grid table/sticky cells only — surrounding cards (control bar, legend, insight banner, stat cards) intentionally stay on the normal `--card` dark navy, `#11161c` |

Other notable implementation details in this file:
- Peak-cell highlighting: for Attraction/Reversal/Flip rows, the specific
  `(strike, expiry)` cell where that row's value peaks gets a ring+tint,
  not just the whole row — computed via `.reduce()` (a plain closure-mutated
  `let` + `forEach` hits a TS "narrowed to `never`" error here, already hit
  and fixed once).
- 3-tier cell brightness (`cellVisual()`): huge / hot / normal, so large
  prints visibly outshine small ones instead of a flat fill.
- Reach-odds probability (`reachProbability()`): reflection-principle
  first-passage estimate, `P(touch) = 2*(1 - CDF(|strike-spot|/sigma))`,
  `sigma = dailyMove * sqrt(days)`. Self-contained `erf`/`normalCdf`
  (Abramowitz-Stegun approximation), no external stats dependency.
- OPEX badges: 3rd-Friday-of-month detection, quarterly = that Friday in
  Mar/Jun/Sep/Dec.
- Sticky headers **must** have an opaque background (`bg-black`, not a
  translucent utility) — a translucent sticky header lets scrolled body
  rows bleed through once it's actually pinned. Already hit this bug once
  (missing date headers turned out to be `position: static` + this same
  translucency issue combined).

## Known naming inconsistencies (deliberate, not bugs)

Per explicit user instruction: rebrand all **user-facing** text/colors to
Alertsify Flow, but leave internal code identifiers alone unless it's
cheap to also fix. Still present on purpose:
`FlowstersAnalytics`, `FlowstersNode`, `FLOWSTERS_DEMO_MODE`,
`lib/analytics/flowsters-nodes.ts`, `components/flowsters-logo.tsx`
(exports `FlowstersLogo`/`FlowstersMark`, renders the real Alertsify
pinwheel mark), assorted code comments.

## Suggested next steps

1. Get the real Vercel runtime log line for a failing SPX quote request and
   fix `fetchQuote()`'s handling of index tickers accordingly (see Known
   issue #1).
2. Audit `TAPE_SYMBOLS` / `FLOW_UNIVERSE` in `lib/mock-data.ts` for other
   non-equity tickers that might hit the same class of bug.
3. Decide whether Scanner deserves a real UW screener endpoint or should
   stay repurposing Alerts.
4. Confirm the `UW-CLIENT-API-ID` header value against UW's actual docs
   once reachable from wherever you're working.
5. Consider fixing the pre-existing TS `string | null` errors now that
   `ignoreBuildErrors` is masking them — they're unrelated to recent work
   but will keep showing up in any `tsc --noEmit` run.
