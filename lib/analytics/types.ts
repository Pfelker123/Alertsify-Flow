// Canonical analytics contract. Chart, heatmap, dashboard, and flow map all
// consume this single output so they can never disagree about a wall or node.

import type { FlowstersNode } from "./node-model"

export type { FlowstersNode }

export type LevelType =
  | "gamma-flip"
  | "call-wall"
  | "put-wall"
  | "attraction"
  | "continuation"
  | "reversal"
  | "buy-above"
  | "sell-below"

export type ExpirationScope = "0dte" | "daily" | "weekly" | "monthly" | "all"

export interface Level {
  id: string
  type: LevelType
  price: number
  /** Percentile rank (0-100) of this level's structural significance. */
  strength: number
  /** How confident we are given available inputs (0-100). */
  confidence: number
  expirationScope: ExpirationScope
  /** Transparent, human-readable explanation of why this level exists. */
  reason: string
  /** Raw inputs behind the level, for the "show your work" UI. */
  inputs: Record<string, number | string | boolean>
}

export interface StrikeAnalytics {
  strike: number
  callGex: number
  putGex: number
  netGex: number
  callOi: number
  putOi: number
  callVolume: number
  putVolume: number
  /** Running cumulative net GEX from lowest strike up to this one. */
  cumulativeNetGex: number
  /** Signed distance from spot as a percentage. */
  distancePct: number
}

export interface EvidenceItem {
  label: string
  detail: string
  value?: number | string
}

export interface FlowstersAnalytics {
  symbol: string
  spot: number
  computedAt: string
  /** 0-100 composite of which required inputs were available. */
  dataQuality: number
  gammaFlip: Level | null
  callWall: Level | null
  putWall: Level | null
  attractionNodes: Level[]
  continuationNodes: Level[]
  reversalNodes: Level[]
  buyAbove: Level | null
  sellBelow: Level | null
  /**
   * Canonical rich node set from the new Flowsters node engine (states,
   * zones, structural/live, hysteresis). The Level arrays above are derived
   * from these so existing surfaces keep working unchanged.
   */
  nodes: FlowstersNode[]
  strikeRows: StrikeAnalytics[]
  evidence: EvidenceItem[]
  warnings: string[]
}

// ---- Engine inputs (already-fetched upstream data) ----

export interface StrikeInput {
  strike: number
  callGex: number
  putGex: number
  callOi?: number
  putOi?: number
  callVolume?: number
  putVolume?: number
}

export interface FlowInput {
  bullishPremium: number
  bearishPremium: number
  netCallPremium: number
  netPutPremium: number
}

export interface CandleInput {
  epoch: number
  open: number
  high: number
  low: number
  close: number
  volume?: number
}

export type EngineInputKey =
  | "quote"
  | "candles"
  | "gexByStrike"
  | "chain"
  | "flow"

export interface StrikeExpiryExposureInput {
  strike: number
  expiration: string
  netExposure: number
}

export interface EngineInputs {
  symbol: string
  spot: number
  strikes: StrikeInput[]
  candles?: CandleInput[]
  flow?: FlowInput | null
  /** Per-(strike,expiration) net exposure for cross-expiration agreement. */
  perExpiry?: StrikeExpiryExposureInput[]
  /** Timeframe bucket for node ids and expected-move scaling. */
  timeframe?: "intraday" | "daily" | "weekly"
  /** Whether the upstream data is live/delayed/stale for node labeling. */
  dataStatus?: "live" | "delayed" | "stale" | "unavailable"
  /** Which required inputs actually resolved with usable data. */
  inputStatus: Record<EngineInputKey, boolean>
}

/** Weights used for the composite data-quality score (sum = 100). */
export const INPUT_WEIGHTS: Record<EngineInputKey, number> = {
  quote: 20,
  candles: 20,
  gexByStrike: 30,
  chain: 20,
  flow: 10,
}
