// The new Flowsters node engine. Replaces the previous ad-hoc node math with
// the model described in NODE_ENGINE_SPEC: robust normalization, local
// concentration, cross-expiration agreement, volatility-aware distance,
// attraction/reversal/continuation/wall scoring, and zone clustering.
//
// It emits candidate nodes (no state). The node-store then applies
// consecutive-update confirmation and hysteresis to assign the final state.

import type { CandleInput, StrikeAnalytics } from "./types"
import type {
  FlowstersNode,
  NodeDataStatus,
  NodeEngineConfig,
  NodeTimeframe,
  NodeType,
} from "./node-model"
import {
  DEFAULT_NODE_CONFIG,
  distanceScore,
  percentileRank01,
} from "./node-model"

/** Per-(strike,expiration) net exposure, used for cross-expiration agreement. */
export interface StrikeExpiryExposure {
  strike: number
  expiration: string
  netExposure: number
}

export interface BuildNodesArgs {
  symbol: string
  spot: number
  rows: StrikeAnalytics[]
  candles?: CandleInput[]
  perExpiry?: StrikeExpiryExposure[]
  flow?: {
    netCallPremium: number
    netPutPremium: number
  } | null
  timeframe?: NodeTimeframe
  dataStatus?: NodeDataStatus
  config?: NodeEngineConfig
}

/** Estimate a volatility-based expected move (price units) from candles. */
function computeExpectedMove(candles: CandleInput[] | undefined, spot: number): number {
  // Floor/ceil keep the band sensible across tickers. The floor (1.5% of spot)
  // prevents a tiny intraday ATR from collapsing the reachable band so far
  // that even adjacent strikes get rejected.
  const floor = spot * 0.015
  const ceil = spot * 0.08
  if (!candles || candles.length < 5) return spot * 0.02
  const window = candles.slice(-14)
  let trSum = 0
  for (let i = 1; i < window.length; i++) {
    const cur = window[i]
    const prev = window[i - 1]
    const tr = Math.max(
      cur.high - cur.low,
      Math.abs(cur.high - prev.close),
      Math.abs(cur.low - prev.close),
    )
    trSum += tr
  }
  const atr = trSum / Math.max(1, window.length - 1)
  // Scale one-bar ATR up to a session-sized expected travel band.
  const est = atr * 4
  return Math.min(ceil, Math.max(floor, est))
}

/** Infer the typical spacing between strikes (price units). */
function strikeStep(rows: StrikeAnalytics[]): number {
  if (rows.length < 2) return 1
  const gaps: number[] = []
  for (let i = 1; i < rows.length; i++) {
    const g = rows[i].strike - rows[i - 1].strike
    if (g > 0) gaps.push(g)
  }
  gaps.sort((a, b) => a - b)
  return gaps[Math.floor(gaps.length / 2)] || 1
}

/** Count how many expirations meaningfully agree at a strike. */
function crossExpirationCount(
  perExpiry: StrikeExpiryExposure[] | undefined,
  strike: number,
  step: number,
): number {
  if (!perExpiry?.length) return 1
  const near = perExpiry.filter(
    (e) => Math.abs(e.strike - strike) <= step / 2 && Math.abs(e.netExposure) > 0,
  )
  return Math.max(1, new Set(near.map((e) => e.expiration)).size)
}

/** Local concentration: how much a strike's |net| dominates its neighbors. */
function localConcentration(rows: StrikeAnalytics[], idx: number): number {
  const here = Math.abs(rows[idx].netGex)
  if (here === 0) return 0
  const neighbors: number[] = []
  for (let d = 1; d <= 2; d++) {
    if (rows[idx - d]) neighbors.push(Math.abs(rows[idx - d].netGex))
    if (rows[idx + d]) neighbors.push(Math.abs(rows[idx + d].netGex))
  }
  const avgN = neighbors.length
    ? neighbors.reduce((s, x) => s + x, 0) / neighbors.length
    : 0
  if (avgN === 0) return 1
  return Math.min(1, here / (here + avgN))
}

interface Candidate {
  type: NodeType
  strike: number
  idx: number
  rawScore: number
  direction: "bullish" | "bearish" | "neutral"
  reason: string
  netGex: number
  callExposure: number
  putExposure: number
  openInterest: number
  volume: number
}

/**
 * Build candidate nodes for a symbol from aggregated strike analytics.
 * Produces attraction, reversal, continuation, and buy/sell wall candidates,
 * de-duplicated by strike with a stable priority order.
 */
export function buildFlowstersNodes(args: BuildNodesArgs): FlowstersNode[] {
  const {
    symbol,
    spot,
    rows,
    candles,
    perExpiry,
    flow,
    timeframe = "daily",
    dataStatus = "live",
    config = DEFAULT_NODE_CONFIG,
  } = args

  if (!rows.length || spot <= 0) return []

  const step = strikeStep(rows)
  const expectedMove = computeExpectedMove(candles, spot)
  // Rank by MAGNITUDE. Put gamma is stored as a negative number, so ranking
  // raw signed values would score the strongest (most negative) put walls the
  // lowest. Absolute value makes call and put wall strength directly
  // comparable and correctly ordered.
  const allNet = rows.map((r) => Math.abs(r.netGex))
  const allCall = rows.map((r) => Math.abs(r.callGex))
  const allPut = rows.map((r) => Math.abs(r.putGex))
  const allOi = rows.map((r) => r.callOi + r.putOi)
  const allVol = rows.map((r) => r.callVolume + r.putVolume)

  const flowBull = flow ? flow.netCallPremium : 0
  const flowBear = flow ? Math.abs(flow.netPutPremium) : 0
  const flowTotal = flowBull + flowBear

  const aw = config.attractionWeights
  const rw = config.reversalWeights

  const candidates: Candidate[] = []

  rows.forEach((r, idx) => {
    const distPrice = Math.abs(r.strike - spot)
    const normDist = distPrice / expectedMove
    const dScore = distanceScore(normDist)
    const conc = localConcentration(rows, idx)
    const crossN = crossExpirationCount(perExpiry, r.strike, step)
    const crossScore = Math.min(1, crossN / 4)
    const oi = r.callOi + r.putOi
    const vol = r.callVolume + r.putVolume

    // ---- Attraction: magnet strikes near spot ----
    const attrRaw =
      aw.gammaConcentration * percentileRank01(Math.abs(r.netGex), allNet) +
      aw.openInterestConcentration * percentileRank01(oi, allOi) +
      aw.volumeExposure * percentileRank01(vol, allVol) +
      aw.crossExpirationAgreement * crossScore +
      aw.distanceScore * dScore +
      aw.persistence * 0.5 +
      aw.historicalInteraction * 0.5
    if (normDist <= 1.5) {
      candidates.push({
        type: "attraction",
        strike: r.strike,
        idx,
        rawScore: attrRaw,
        direction: "neutral",
        reason:
          "High combined gamma, open interest and volume concentration near spot — price tends to gravitate here.",
        netGex: r.netGex,
        callExposure: r.callGex,
        putExposure: r.putGex,
        openInterest: oi,
        volume: vol,
      })
    }

    // ---- Directional walls / reversals ----
    const above = r.strike > spot
    const below = r.strike < spot
    const greekAgreement = above
      ? percentileRank01(Math.abs(r.callGex), allCall)
      : percentileRank01(Math.abs(r.putGex), allPut)
    const flowConfirm = flowTotal
      ? above
        ? flowBear / flowTotal
        : flowBull / flowTotal
      : 0.5
    const wallBase =
      rw.directionalWallStrength * greekAgreement +
      rw.localConcentration * conc +
      rw.greekAgreement * greekAgreement +
      rw.historicalRejection * 0.5 +
      rw.unusualFlowConfirmation * flowConfirm +
      rw.crossExpirationAgreement * crossScore +
      rw.persistence * 0.5
    // Volatility-aware distance: a "level to watch before price arrives" must
    // be reachable. Fold the distance score in so far-OTM strikes fall away.
    const wallRaw = wallBase * (0.45 + 0.55 * dScore)

    // Only consider reversal walls within a reachable band so we never print
    // levels far from spot. The band scales with volatility (expected move)
    // but also has a percentage-of-spot floor so low-ATR names still surface
    // their near-spot turn levels.
    const reachablePct = Math.abs(r.strike - spot) / spot <= 0.1
    const reachableEm = normDist <= 3
    if (
      (reachablePct || reachableEm) &&
      ((above && r.callGex > 0) || (below && r.putGex < 0))
    ) {
      candidates.push({
        type: "reversal",
        strike: r.strike,
        idx,
        rawScore: wallRaw,
        direction: above ? "bearish" : "bullish",
        reason: above
          ? "Call-gamma concentration above spot where dealer hedging tends to reject rallies — a level to watch before price arrives."
          : "Put-gamma concentration below spot where dealer hedging tends to cushion declines — a level to watch before price arrives.",
        netGex: r.netGex,
        callExposure: r.callGex,
        putExposure: r.putGex,
        openInterest: oi,
        volume: vol,
      })
    }
  })

  // De-duplicate by strike using a stable priority order so each strike is
  // owned by exactly one node type. Attraction wins ties near spot.
  const priority: Record<NodeType, number> = {
    attraction: 0,
    buy_wall: 1,
    sell_wall: 1,
    reversal: 2,
    continuation: 3,
  }
  const byStrike = new Map<number, Candidate>()
  for (const c of candidates) {
    const existing = byStrike.get(c.strike)
    if (
      !existing ||
      priority[c.type] < priority[existing.type] ||
      (priority[c.type] === priority[existing.type] && c.rawScore > existing.rawScore)
    ) {
      byStrike.set(c.strike, c)
    }
  }

  // Select only top-quality zones per type so the map stays legible:
  //  - one attraction (the main daily magnet),
  //  - the nearest/strongest reversals on BOTH sides of spot (predictive),
  //  - up to two continuation strikes beyond the dominant walls.
  const deduped = Array.from(byStrike.values())
  const byScore = (a: Candidate, b: Candidate) => b.rawScore - a.rawScore

  const attraction = deduped
    .filter((c) => c.type === "attraction")
    .sort(byScore)
    .slice(0, 1)
  const reversalsAbove = deduped
    .filter((c) => c.type === "reversal" && c.strike > spot)
    .sort(byScore)
    .slice(0, 3)
  const reversalsBelow = deduped
    .filter((c) => c.type === "reversal" && c.strike < spot)
    .sort(byScore)
    .slice(0, 3)

  // ---- Promote the strongest SURVIVING reversal on each side to a wall ----
  // Done AFTER dedup/selection so a wall is always a level that actually made
  // the cut (the pre-dedup candidate could be overwritten by an attraction at
  // the same strike and vanish). The buy/sell walls ARE the dominant reversal
  // levels: the primary ceiling above spot and the primary floor below.
  const sellWallC = reversalsAbove[0]
  const buyWallC = reversalsBelow[0]
  if (sellWallC) {
    sellWallC.type = "sell_wall"
    sellWallC.rawScore = Math.max(sellWallC.rawScore, 0.8)
    sellWallC.direction = "bearish"
    sellWallC.reason =
      "Dominant call-gamma resistance above spot — the session's primary ceiling where rallies tend to reject."
  }
  if (buyWallC) {
    buyWallC.type = "buy_wall"
    buyWallC.rawScore = Math.max(buyWallC.rawScore, 0.8)
    buyWallC.direction = "bullish"
    buyWallC.reason =
      "Dominant put-gamma support below spot — the session's primary floor where declines tend to cushion."
  }
  // Remaining reversals (exclude the promoted walls) keep the "reversal" type.
  const reversals = [
    ...reversalsAbove.filter((c) => c.type === "reversal"),
    ...reversalsBelow.filter((c) => c.type === "reversal"),
  ]

  // ---- Continuation: acceleration strikes just beyond the dominant walls ----
  const continuation: Candidate[] = []
  const addContinuation = (
    anchorStrike: number | undefined,
    dir: "bullish" | "bearish",
  ) => {
    if (anchorStrike == null) return
    const beyond =
      dir === "bearish"
        ? rows.filter((r) => r.strike > anchorStrike)
        : rows.filter((r) => r.strike < anchorStrike)
    const pick = beyond.sort((a, b) => Math.abs(b.netGex) - Math.abs(a.netGex))[0]
    if (!pick) return
    const normDist = Math.abs(pick.strike - spot) / expectedMove
    if (normDist > 3) return // keep continuation reachable too
    const idx = rows.indexOf(pick)
    continuation.push({
      type: "continuation",
      strike: pick.strike,
      idx,
      rawScore:
        (0.66 + 0.2 * percentileRank01(Math.abs(pick.netGex), allNet)) *
        (0.6 + 0.4 * distanceScore(normDist)),
      direction: dir,
      reason:
        dir === "bearish"
          ? "Beyond the resistance wall: a breakout above tends to accelerate toward this strike."
          : "Beyond the support wall: a breakdown below tends to accelerate toward this strike.",
      netGex: pick.netGex,
      callExposure: pick.callGex,
      putExposure: pick.putGex,
      openInterest: pick.callOi + pick.putOi,
      volume: pick.callVolume + pick.putVolume,
    })
  }
  addContinuation(sellWallC?.strike, "bearish")
  addContinuation(buyWallC?.strike, "bullish")

  const finalCandidates = [
    ...attraction,
    ...(sellWallC ? [sellWallC] : []),
    ...(buyWallC ? [buyWallC] : []),
    ...reversals,
    ...continuation.slice(0, 2),
  ]

  const now = new Date().toISOString()
  return finalCandidates.map((c): FlowstersNode => {
    const distPrice = Math.abs(c.strike - spot)
    const normDist = distPrice / expectedMove
    const crossN = crossExpirationCount(perExpiry, c.strike, step)
    // Structural nodes are OI-dominant and further out; live nodes are driven
    // by today's volume/flow and sit closer to spot.
    const oiHeavy = c.openInterest > 0 && c.openInterest >= c.volume
    const structure = oiHeavy && normDist > 0.5 ? "structural" : "live"
    const strength = Math.max(0, Math.min(100, Math.round(c.rawScore * 100)))
    return {
      id: `${symbol}:${timeframe}:${c.type}:${c.strike.toFixed(2)}`,
      symbol,
      type: c.type,
      direction: c.direction,
      timeframe,
      structure,
      state: "emerging",
      lowerBound: +(c.strike - step / 2).toFixed(2),
      upperBound: +(c.strike + step / 2).toFixed(2),
      center: c.strike,
      dominantStrike: c.strike,
      strength,
      rawScore: +c.rawScore.toFixed(4),
      distancePct: spot > 0 ? +(((c.strike - spot) / spot) * 100).toFixed(2) : 0,
      distanceExpectedMove: +normDist.toFixed(2),
      persistenceUpdates: 0,
      crossExpirationCount: crossN,
      netGex: Math.round(c.netGex),
      oiGex: undefined,
      volumeGex: undefined,
      callExposure: Math.round(c.callExposure),
      putExposure: Math.round(c.putExposure),
      openInterest: c.openInterest,
      volume: c.volume,
      reason: c.reason,
      updatedAt: now,
      dataStatus,
    }
  })
}
