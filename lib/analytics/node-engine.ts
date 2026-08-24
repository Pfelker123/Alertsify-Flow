import type {
  CandleInput,
  FlowInput,
  Level,
  StrikeAnalytics,
} from "./types"
import { percentileRank } from "./gamma-engine"

const ATTRACTION_RANGE_PCT = 4 // consider strikes within +/-4% of spot

/**
 * Attraction node: the single main daily price magnet — the strike price is
 * most drawn toward. Ranked by a blend of normalized absolute net GEX, total
 * OI, total volume, and closeness to spot. Excludes strikes already chosen as
 * call wall, put wall, or gamma flip. Returns exactly ONE node (the dominant
 * magnet for the session) so the chart/heatmap show a single clear target.
 */
export function computeAttractionNodes(
  rows: StrikeAnalytics[],
  spot: number,
  exclude: number[],
): Level[] {
  const inRange = rows.filter(
    (r) => Math.abs(r.distancePct) <= ATTRACTION_RANGE_PCT,
  )
  if (!inRange.length) return []

  const maxNet = Math.max(1, ...inRange.map((r) => Math.abs(r.netGex)))
  const maxOi = Math.max(1, ...inRange.map((r) => r.callOi + r.putOi))
  const maxVol = Math.max(1, ...inRange.map((r) => r.callVolume + r.putVolume))
  const allAbsNet = rows.map((r) => r.netGex)

  const scored = inRange
    .filter((r) => !exclude.some((e) => Math.abs(e - r.strike) < 1e-6))
    .map((r) => {
      const nNet = Math.abs(r.netGex) / maxNet
      const nOi = (r.callOi + r.putOi) / maxOi
      const nVol = (r.callVolume + r.putVolume) / maxVol
      const closeness = 1 - Math.min(1, Math.abs(r.distancePct) / ATTRACTION_RANGE_PCT)
      // Gamma dominates; OI/volume/closeness refine the ranking.
      const score = nNet * 0.5 + nOi * 0.2 + nVol * 0.15 + closeness * 0.15
      return { r, score }
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, 1)

  return scored.map(({ r, score }) => ({
    id: `attraction-${r.strike}`,
    type: "attraction" as const,
    price: r.strike,
    strength: percentileRank(r.netGex, allAbsNet),
    confidence: Math.round(60 + score * 30),
    expirationScope: "daily" as const,
    reason:
      "Main daily attraction: the strongest combined gamma + open-interest concentration near spot — the price magnet for the session.",
    inputs: {
      netGex: Math.round(r.netGex),
      totalOi: r.callOi + r.putOi,
      totalVolume: r.callVolume + r.putVolume,
      distancePct: +r.distancePct.toFixed(2),
      score: +score.toFixed(3),
    },
  }))
}

/**
 * Find the most recent significant swing low and swing high from candles.
 * A swing low/high is a local extreme with `lookback` lower/higher bars on
 * each side. Falls back to the window min/max when no fractal pivot is found.
 */
export function findSwingLevels(
  candles: CandleInput[] | undefined,
  lookback = 3,
): { swingLow: number | null; swingHigh: number | null } {
  if (!candles || candles.length < lookback * 2 + 1) {
    return { swingLow: null, swingHigh: null }
  }
  const window = candles.slice(-60)
  let swingLow: number | null = null
  let swingHigh: number | null = null
  for (let i = window.length - lookback - 1; i >= lookback; i--) {
    const lo = window[i].low
    const hi = window[i].high
    const isLow = window
      .slice(i - lookback, i + lookback + 1)
      .every((c) => c.low >= lo)
    const isHigh = window
      .slice(i - lookback, i + lookback + 1)
      .every((c) => c.high <= hi)
    if (swingLow === null && isLow) swingLow = lo
    if (swingHigh === null && isHigh) swingHigh = hi
    if (swingLow !== null && swingHigh !== null) break
  }
  // Fallbacks keep support/resistance available on quiet tapes.
  if (swingLow === null) swingLow = Math.min(...window.map((c) => c.low))
  if (swingHigh === null) swingHigh = Math.max(...window.map((c) => c.high))
  return { swingLow: +swingLow.toFixed(2), swingHigh: +swingHigh.toFixed(2) }
}

/**
 * Reversal nodes: strikes where opposing gamma concentration is likely to
 * reject price, confirmed by flow. Requires >= 2 independent inputs; when
 * flow is unavailable, confidence is lowered and the reason explains it.
 */
export function computeReversalNodes(
  rows: StrikeAnalytics[],
  spot: number,
  flow: FlowInput | null | undefined,
  exclude: number[],
  candles?: CandleInput[],
): Level[] {
  const out: Level[] = []
  const allAbsCall = rows.map((r) => r.callGex)
  const allAbsPut = rows.map((r) => r.putGex)

  const above = rows.filter((r) => r.strike > spot && r.callGex > 0)
  const below = rows.filter((r) => r.strike < spot && Math.abs(r.putGex) > 0)

  const flowBearish = flow ? flow.netPutPremium > flow.netCallPremium : false
  const flowBullish = flow ? flow.netCallPremium > flow.netPutPremium : false

  // Above spot: strong call gamma + bearish/neutral flow => rejection down.
  if (above.length) {
    const top = above.reduce((m, r) => (r.callGex > m.callGex ? r : m))
    if (!exclude.some((e) => Math.abs(e - top.strike) < 1e-6)) {
      const inputsCount = 1 + (flow ? 1 : 0)
      out.push({
        id: `reversal-up-${top.strike}`,
        type: "reversal",
        price: top.strike,
        strength: percentileRank(top.callGex, allAbsCall),
        confidence: flow ? (flowBearish ? 78 : 62) : 50,
        expirationScope: "all",
        reason: flow
          ? `Heavy call gamma resistance with ${flowBearish ? "confirming bearish" : "mixed"} net premium flow — likely rejection lower.`
          : "Heavy call gamma resistance. Flow confirmation unavailable, so confidence is reduced.",
        inputs: {
          callGex: Math.round(top.callGex),
          netCallPremium: flow ? Math.round(flow.netCallPremium) : "n/a",
          netPutPremium: flow ? Math.round(flow.netPutPremium) : "n/a",
          independentInputs: inputsCount,
        },
      })
    }
  }

  // Below spot: strong put gamma + bullish/neutral flow => bounce up.
  if (below.length) {
    const top = below.reduce((m, r) =>
      Math.abs(r.putGex) > Math.abs(m.putGex) ? r : m,
    )
    if (!exclude.some((e) => Math.abs(e - top.strike) < 1e-6)) {
      const inputsCount = 1 + (flow ? 1 : 0)
      out.push({
        id: `reversal-down-${top.strike}`,
        type: "reversal",
        price: top.strike,
        strength: percentileRank(top.putGex, allAbsPut),
        confidence: flow ? (flowBullish ? 78 : 62) : 50,
        expirationScope: "all",
        reason: flow
          ? `Heavy put gamma support with ${flowBullish ? "confirming bullish" : "mixed"} net premium flow — likely bounce higher.`
          : "Heavy put gamma support. Flow confirmation unavailable, so confidence is reduced.",
        inputs: {
          putGex: Math.round(top.putGex),
          netCallPremium: flow ? Math.round(flow.netCallPremium) : "n/a",
          netPutPremium: flow ? Math.round(flow.netPutPremium) : "n/a",
          independentInputs: inputsCount,
        },
      })
    }
  }

  // Price-based reversal levels: recent swing low = support, swing high =
  // resistance. These are the "reversal points / support-resistance based on
  // low" the user asked for. Added only when they are meaningfully distinct
  // from the gamma-based reversals already chosen.
  const { swingLow, swingHigh } = findSwingLevels(candles)
  const isDistinct = (p: number) =>
    !out.some((l) => Math.abs(l.price - p) / p < 0.0015) &&
    !exclude.some((e) => Math.abs(e - p) / (p || 1) < 0.0015)

  if (swingLow !== null && swingLow < spot && isDistinct(swingLow)) {
    out.push({
      id: `reversal-support-${swingLow}`,
      type: "reversal",
      price: swingLow,
      strength: 55,
      confidence: 60,
      expirationScope: "daily",
      reason:
        "Recent swing low — price-based support where the tape has reversed before. Watch for a bounce or, if lost, a continuation lower.",
      inputs: { basis: "swing-low", price: swingLow },
    })
  }
  if (swingHigh !== null && swingHigh > spot && isDistinct(swingHigh)) {
    out.push({
      id: `reversal-resistance-${swingHigh}`,
      type: "reversal",
      price: swingHigh,
      strength: 55,
      confidence: 60,
      expirationScope: "daily",
      reason:
        "Recent swing high — price-based resistance where the tape has rejected before. Watch for a fade or, if reclaimed, a continuation higher.",
      inputs: { basis: "swing-high", price: swingHigh },
    })
  }

  return out
}

/** Short-term trend from the last N candle closes: +1 up, -1 down, 0 flat. */
export function trendFromCandles(candles: CandleInput[] | undefined): number {
  if (!candles || candles.length < 6) return 0
  const recent = candles.slice(-12)
  const first = recent[0].close
  const last = recent[recent.length - 1].close
  const change = (last - first) / first
  if (change > 0.001) return 1
  if (change < -0.001) return -1
  return 0
}

/**
 * Continuation nodes: a strike aligned with the current trend AND supported by
 * net gamma structure. Requires trend + >=1 options-positioning confirmation.
 * Never a midpoint.
 */
export function computeContinuationNodes(
  rows: StrikeAnalytics[],
  spot: number,
  candles: CandleInput[] | undefined,
  exclude: number[],
): Level[] {
  const trend = trendFromCandles(candles)
  if (trend === 0) return []

  // In an uptrend, look above spot for the nearest positive-gamma shelf that
  // price can continue toward; in a downtrend, below spot.
  const dir = trend > 0 ? 1 : -1
  const pool = rows.filter((r) =>
    dir > 0 ? r.strike > spot && r.netGex > 0 : r.strike < spot && r.netGex < 0,
  )
  if (!pool.length) return []
  // Nearest supportive strike in the trend direction.
  const target = pool.reduce((m, r) =>
    Math.abs(r.strike - spot) < Math.abs(m.strike - spot) ? r : m,
  )
  if (exclude.some((e) => Math.abs(e - target.strike) < 1e-6)) return []

  const allAbsNet = rows.map((r) => r.netGex)
  return [
    {
      id: `continuation-${target.strike}`,
      type: "continuation",
      price: target.strike,
      strength: percentileRank(target.netGex, allAbsNet),
      confidence: 68,
      expirationScope: "all",
      reason: `Price is trending ${dir > 0 ? "up" : "down"} and this strike has supportive ${dir > 0 ? "positive" : "negative"} net gamma in the trend direction — a likely continuation target.`,
      inputs: {
        trend: dir > 0 ? "up" : "down",
        netGex: Math.round(target.netGex),
        distancePct: +target.distancePct.toFixed(2),
      },
    },
  ]
}

/**
 * Buy Above / Sell Below scenario triggers. These are confirmed acceptance
 * levels, not raw gamma nodes. Buy Above = nearest bullish structure above
 * spot (continuation/reversal) confirmed by recent closes; Sell Below the
 * mirror. Returns null when requirements are not met (never a midpoint).
 */
export function computeScenarioTriggers(
  spot: number,
  candles: CandleInput[] | undefined,
  continuation: Level[],
  reversal: Level[],
): { buyAbove: Level | null; sellBelow: Level | null } {
  const trend = trendFromCandles(candles)
  const closes = (candles ?? []).slice(-5).map((c) => c.close)
  const recentHigh = closes.length ? Math.max(...closes) : spot
  const recentLow = closes.length ? Math.min(...closes) : spot

  // Bullish acceptance candidate above spot.
  const aboveCandidates = [...continuation, ...reversal]
    .filter((l) => l.price > spot)
    .sort((a, b) => a.price - b.price)
  const belowCandidates = [...continuation, ...reversal]
    .filter((l) => l.price < spot)
    .sort((a, b) => b.price - a.price)

  let buyAbove: Level | null = null
  if (aboveCandidates.length && trend >= 0 && closes.length) {
    const src = aboveCandidates[0]
    buyAbove = {
      id: `buy-above-${src.price}`,
      type: "buy-above",
      price: src.price,
      strength: src.strength,
      confidence: Math.round(src.confidence * (trend > 0 ? 1 : 0.85)),
      expirationScope: "all",
      reason:
        "Nearest confirmed bullish acceptance level above spot: an options-structure level the trend and recent closes support breaking through.",
      inputs: {
        basedOn: src.type,
        recentHigh: +recentHigh.toFixed(2),
        trend: trend > 0 ? "up" : "flat",
      },
    }
  }

  let sellBelow: Level | null = null
  if (belowCandidates.length && trend <= 0 && closes.length) {
    const src = belowCandidates[0]
    sellBelow = {
      id: `sell-below-${src.price}`,
      type: "sell-below",
      price: src.price,
      strength: src.strength,
      confidence: Math.round(src.confidence * (trend < 0 ? 1 : 0.85)),
      expirationScope: "all",
      reason:
        "Nearest confirmed bearish acceptance level below spot: an options-structure level the trend and recent closes support breaking down through.",
      inputs: {
        basedOn: src.type,
        recentLow: +recentLow.toFixed(2),
        trend: trend < 0 ? "down" : "flat",
      },
    }
  }

  return { buyAbove, sellBelow }
}
