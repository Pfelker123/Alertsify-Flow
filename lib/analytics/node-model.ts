// Rich Flowsters node model (per V0_MASTER_PROMPT / NODE_ENGINE_SPEC).
// This is the canonical node representation the new engine produces. The
// existing `Level` contract is derived from these nodes so all current
// surfaces keep working while the calculations underneath are replaced.

export type NodeType =
  | "attraction"
  | "reversal"
  | "continuation"
  | "buy_wall"
  | "sell_wall"

export type NodeState =
  | "emerging"
  | "confirmed"
  | "strengthening"
  | "weakening"
  | "retired"

export type NodeStructure = "structural" | "live"

export type NodeDataStatus = "live" | "delayed" | "stale" | "unavailable"

export type NodeTimeframe = "intraday" | "daily" | "weekly"

export interface FlowstersNode {
  id: string
  symbol: string
  type: NodeType
  direction: "bullish" | "bearish" | "neutral"
  timeframe: NodeTimeframe
  structure: NodeStructure
  state: NodeState
  lowerBound: number
  upperBound: number
  center: number
  dominantStrike: number
  /** Display strength 0-100. */
  strength: number
  /** Raw 0-1 composite score before scaling. */
  rawScore: number
  /** Signed distance from spot as a percentage. */
  distancePct: number
  /** Distance expressed in expected-move units (volatility aware). */
  distanceExpectedMove?: number
  /** How many consecutive updates this node has survived. */
  persistenceUpdates: number
  /** How many expirations agree on this level. */
  crossExpirationCount: number
  netGex?: number
  oiGex?: number
  volumeGex?: number
  callExposure?: number
  putExposure?: number
  openInterest?: number
  volume?: number
  /** Human-readable explanation for the "show your work" UI. */
  reason: string
  updatedAt: string
  dataStatus: NodeDataStatus
}

export interface NodeEngineConfig {
  thresholds: {
    activation: number
    removal: number
    emergingConsecutiveUpdates: number
    confirmedConsecutiveUpdates: number
    retireConsecutiveUpdates: number
  }
  attractionWeights: {
    gammaConcentration: number
    openInterestConcentration: number
    volumeExposure: number
    crossExpirationAgreement: number
    distanceScore: number
    persistence: number
    historicalInteraction: number
  }
  reversalWeights: {
    directionalWallStrength: number
    localConcentration: number
    greekAgreement: number
    historicalRejection: number
    unusualFlowConfirmation: number
    crossExpirationAgreement: number
    persistence: number
  }
  heatmap: {
    defaultMode: "all" | "significant" | "top"
    defaultDetail: "simple" | "advanced"
    maxTopNodes: number
  }
}

// Defaults mirror CONFIG_DEFAULTS.json from the spec bundle.
export const DEFAULT_NODE_CONFIG: NodeEngineConfig = {
  thresholds: {
    // Quality selection (which strikes become nodes) happens in the node
    // engine's top-N-per-side selection. The store's job is hysteresis and
    // anti-flicker, NOT re-filtering quality — so this activation/removal band
    // is a low noise floor. A brand-new node must clear `activation`; an
    // existing one survives until it drops below the lower `removal` value.
    activation: 40,
    removal: 28,
    emergingConsecutiveUpdates: 2,
    confirmedConsecutiveUpdates: 4,
    retireConsecutiveUpdates: 3,
  },
  attractionWeights: {
    gammaConcentration: 0.25,
    openInterestConcentration: 0.2,
    volumeExposure: 0.15,
    crossExpirationAgreement: 0.15,
    distanceScore: 0.1,
    persistence: 0.1,
    historicalInteraction: 0.05,
  },
  reversalWeights: {
    directionalWallStrength: 0.25,
    localConcentration: 0.2,
    greekAgreement: 0.15,
    historicalRejection: 0.15,
    unusualFlowConfirmation: 0.1,
    crossExpirationAgreement: 0.1,
    persistence: 0.05,
  },
  heatmap: {
    defaultMode: "significant",
    defaultDetail: "simple",
    maxTopNodes: 12,
  },
}

// ---- Robust normalization helpers (outliers are the norm in options data) ----

/** Percentile rank (0-1) of |value| within |all|. */
export function percentileRank01(value: number, all: number[]): number {
  if (!all.length) return 0
  const v = Math.abs(value)
  const below = all.filter((x) => Math.abs(x) <= v).length
  return below / all.length
}

/** Median of a numeric array. */
export function median(xs: number[]): number {
  if (!xs.length) return 0
  const s = [...xs].sort((a, b) => a - b)
  const mid = Math.floor(s.length / 2)
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2
}

/** Median absolute deviation z-score, robust to outliers. */
export function madZScore(value: number, all: number[]): number {
  if (!all.length) return 0
  const med = median(all)
  const mad = median(all.map((x) => Math.abs(x - med))) || 1e-9
  // 1.4826 scales MAD to be consistent with std dev for normal data.
  return (value - med) / (1.4826 * mad)
}

/**
 * Volatility-aware distance score. `normalizedDistance` is |center-spot| in
 * expected-move units. Smoothly interpolates the spec's suggested curve.
 */
export function distanceScore(normalizedDistance: number): number {
  const pts: [number, number][] = [
    [0, 1.0],
    [0.25, 1.0],
    [0.5, 0.9],
    [1.0, 0.7],
    [1.5, 0.45],
    [3.0, 0.2],
  ]
  const d = Math.max(0, normalizedDistance)
  if (d >= pts[pts.length - 1][0]) return pts[pts.length - 1][1]
  for (let i = 1; i < pts.length; i++) {
    const [x0, y0] = pts[i - 1]
    const [x1, y1] = pts[i]
    if (d <= x1) {
      const t = (d - x0) / (x1 - x0 || 1)
      return y0 + t * (y1 - y0)
    }
  }
  return 0.2
}
