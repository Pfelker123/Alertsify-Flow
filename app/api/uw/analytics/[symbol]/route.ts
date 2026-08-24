import { NextResponse } from "next/server"
import { hasUWKey } from "@/lib/uw/client"
import { gatherData, buildHeatmap } from "@/lib/uw/live-source"
import { computeAnalytics } from "@/lib/analytics"
import { demoInputs, demoHeatmap } from "@/lib/analytics/demo"
import { isDemoMode, ok, demo, unavailable } from "@/lib/market/types"
import type {
  CandleInput,
  EngineInputKey,
  EngineInputs,
  FlowstersAnalytics,
} from "@/lib/analytics/types"
import type { HeatmapGrid, HeatmapMarker } from "@/lib/market/heatmap"
import type { Ticker } from "@/lib/types"

/** The `data` payload carried by the analytics DataEnvelope. */
export interface AnalyticsPayload {
  symbol: string
  spot: number
  quote?: Ticker
  candles: CandleInput[]
  heatmap: HeatmapGrid | null
  analytics: FlowstersAnalytics
  inputStatus: Record<EngineInputKey, boolean>
  errors?: Record<string, string | undefined>
}

const SYMBOL_RE = /^[A-Z][A-Z.]{0,5}$/
const TIMEFRAMES = new Set(["1m", "5m", "15m", "30m", "1h", "daily", "weekly"])
const ENDPOINT = "analytics"

// Nodes are dynamic: the handler must recompute the entire analytics set from
// the latest upstream data on every request. Never let Next cache this route
// or nodes would freeze between polls.
export const dynamic = "force-dynamic"
export const revalidate = 0

export async function GET(
  req: Request,
  ctx: { params: Promise<{ symbol: string }> },
) {
  const { symbol } = await ctx.params
  const sym = symbol.toUpperCase()
  const tfParam = new URL(req.url).searchParams.get("tf") ?? "5m"
  const timeframe = TIMEFRAMES.has(tfParam) ? tfParam : "5m"

  if (!SYMBOL_RE.test(sym)) {
    return NextResponse.json(
      unavailable({ endpoint: ENDPOINT, symbol: sym, error: "Invalid symbol" }),
      { status: 400 },
    )
  }

  // Demo mode: run the real engine on synthetic inputs, clearly flagged.
  if (isDemoMode()) {
    const { inputs, candles } = demoInputs(sym)
    const analytics = computeAnalytics(inputs)
    const heatmap = withMarkers(demoHeatmap(sym), analytics.spot, analytics)
    return NextResponse.json(
      demo(
        { symbol: sym, spot: inputs.spot, candles, heatmap, analytics, inputStatus: inputs.inputStatus },
        { endpoint: ENDPOINT, symbol: sym },
      ),
    )
  }

  if (!hasUWKey()) {
    return NextResponse.json(
      unavailable({
        endpoint: ENDPOINT,
        symbol: sym,
        error: "UNUSUAL_WHALES_API_KEY is not configured on the server.",
      }),
      { status: 503 },
    )
  }

  try {
    const g = await gatherData(sym, timeframe)

    // Quote is the minimum viable input: without a spot there is nothing
    // honest to anchor analytics to.
    if (!g.quote) {
      return NextResponse.json(
        unavailable({
          endpoint: ENDPOINT,
          symbol: sym,
          error: g.errors.quote ?? "Live quote unavailable",
        }),
        { status: 502 },
      )
    }

    const spot = g.quote.price

    // Build the heatmap grid first so we can feed per-(strike,expiration)
    // exposure into the node engine for cross-expiration agreement.
    const grid = g.heatmapSource ? buildHeatmap(sym, spot, g.heatmapSource) : null
    const perExpiry = grid
      ? grid.cells.map((c) => ({
          strike: c.strike,
          expiration: c.expiration,
          netExposure: c.netGex,
        }))
      : undefined

    const tfBucket: "intraday" | "daily" | "weekly" =
      timeframe === "weekly" ? "weekly" : timeframe === "daily" ? "daily" : "intraday"

    const inputs: EngineInputs = {
      symbol: sym,
      spot,
      strikes: g.strikes ?? [],
      candles: g.candles ?? undefined,
      flow: g.chain?.flow ?? null,
      perExpiry,
      timeframe: tfBucket,
      dataStatus: "live",
      inputStatus: g.inputStatus,
    }
    const analytics = computeAnalytics(inputs)

    const candles: CandleInput[] = g.candles ?? []
    const heatmap = grid ? withMarkers(grid, spot, analytics) : null

    // Any failed upstream calls are surfaced (not hidden) via inputStatus and
    // the analytics warnings, while partial data still renders.
    return NextResponse.json(
      ok(
        {
          symbol: sym,
          spot,
          quote: g.quote,
          candles,
          heatmap,
          analytics,
          inputStatus: g.inputStatus,
          errors: g.errors,
        },
        {
          endpoint: ENDPOINT,
          symbol: sym,
          marketTimestamp: g.quote.marketTimestamp,
        },
      ),
    )
  } catch (err) {
    return NextResponse.json(
      unavailable({
        endpoint: ENDPOINT,
        symbol: sym,
        error: err instanceof Error ? err.message : "Unknown server error",
      }),
      { status: 502 },
    )
  }
}

/** Attach spot/flip/wall markers computed by the shared engine. */
function withMarkers(
  grid: HeatmapGrid,
  spot: number,
  analytics: { gammaFlip: { price: number } | null; callWall: { price: number } | null; putWall: { price: number } | null },
): HeatmapGrid {
  const nearest = (p: number) =>
    grid.strikes.length
      ? grid.strikes.reduce((m, s) => (Math.abs(s - p) < Math.abs(m - p) ? s : m))
      : p
  const markers: HeatmapMarker[] = [{ strike: nearest(spot), kind: "spot" }]
  if (analytics.gammaFlip) markers.push({ strike: nearest(analytics.gammaFlip.price), kind: "gamma-flip" })
  if (analytics.callWall) markers.push({ strike: nearest(analytics.callWall.price), kind: "call-wall" })
  if (analytics.putWall) markers.push({ strike: nearest(analytics.putWall.price), kind: "put-wall" })
  return { ...grid, markers }
}
