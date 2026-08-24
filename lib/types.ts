// Core domain types for FLOWSTERS.
// These are intentionally framework-agnostic so a real market/options data
// provider can be wired in later behind the same shapes.

export type Bias = 'bullish' | 'bearish' | 'neutral'

export type NodeKind =
  | 'attraction'
  | 'reversal'
  | 'continuation'
  | 'buy-wall'
  | 'sell-wall'
  | 'spot'

export type Timeframe =
  | '1m'
  | '3m'
  | '5m'
  | '10m'
  | '15m'
  | '30m'
  | '1h'
  | 'daily'
  | 'weekly'

export type NodeHorizon = 'intraday' | 'daily' | 'weekly'

export interface Ticker {
  symbol: string
  name: string
  price: number
  change: number // absolute
  changePercent: number
  bias: Bias
  spark: number[] // small sparkline series
}

export interface PriceNode {
  id: string
  price: number
  kind: NodeKind
  horizon: NodeHorizon
  label: string
  strength: number // 0-100 relative magnitude
}

export interface HeatCell {
  strike: number
  expiration: string
  pressure: number // -100 (heavy sell) .. +100 (heavy buy)
  label?: string
}

export interface Candle {
  time: string
  epoch: number // UNIX seconds — used by the TradingView chart time scale
  open: number
  high: number
  low: number
  close: number
  volume?: number // real traded volume for the bar, when provided by the API
}

export type SignalType =
  | 'buy'
  | 'sell'
  | 'reversal'
  | 'continuation'

export interface Signal {
  id: string
  symbol: string
  type: SignalType
  level: number
  time: string
  note: string
}

// A signal the user clicked from the Alerts feed/ticker, surfaced on the chart.
export interface FocusSignal {
  symbol: string
  type: SignalType
  price: number
  time: string
  note: string
}

export interface ActivitySummary {
  signalsTriggered: number
  nodesUpdated: number
  reversalAlerts: number
  continuationAlerts: number
}

// --- FLOWSTERS dashboard shapes ---

export type LevelLabel =
  | 'Reversal'
  | 'Continuation'
  | 'Attraction'
  | 'Buy Above'
  | 'Sell Below'

export interface KeyLevel {
  id: string
  label: LevelLabel
  kind: NodeKind
  price: number
}

export interface TradePlan {
  setup: 'Long Setup' | 'Short Setup'
  entry: number
  stop: number
  target1: number
  target2: number
  riskReward: number
  confidence: number
  option: string
  optionExpiry: string
  positionSize: number
  positionPct: number
}

export interface FlowSummary {
  netGamma1D: number // in billions
  netGammaW: number
  callPutFlow: number
  callPutBias: Bias
  darkPool: Bias
  putCallRatio: number
  impliedMoveW: number // percent
  spark1D: number[]
  sparkW: number[]
  sparkFlow: number[]
}

export interface AccountInfo {
  broker: string
  buyingPower: number
  dayPnl: number
  dayPnlPct: number
}

export interface GammaColumn {
  label: string
  tag: '0D' | '1D' | 'W' | 'M'
  selected?: boolean
}

export interface GammaCell {
  strike: number
  col: number
  pressure: number // -100..100
  special?: 'attraction' | 'reversal'
}

// --- Detailed GEX board (Voltick-style strike x expiry table) ---

export interface GexBoardColumn {
  label: string // "07/06"
  tag: '0D' | '1D' | 'W' | 'M'
  expiry: string // ISO date
}

export interface GexBoardRow {
  strike: number
  values: (number | null)[] // net GEX $ per column (aligned to columns)
  net: number // aggregate net GEX $ across all expiries
  isSpot: boolean
}

export interface GexBoardMetrics {
  netGex: number // total net GEX $ across the board
  putWall: number
  callWall: number // attraction / call wall ceiling
  zeroDte: number // 0DTE call wall
  gammaFlip: number // zero-gamma crossover
  grower: { strike: number; share: number } // dominant positive-gamma strike + share
  move: number // implied daily move (dollars)
  atmIv: number // ATM implied vol (percent)
  regime: 'positive' | 'negative' // gamma regime
}

export interface GexBoard {
  symbol: string
  spot: number
  columns: GexBoardColumn[]
  rows: GexBoardRow[]
  maxCellAbs: number // for cell color scaling
  maxNetAbs: number // for net bar scaling
  metrics: GexBoardMetrics
  live: boolean
}

// --- Unusual options flow (per-print ticker tape / table) ---

export type FlowSide = 'call' | 'put'
export type FlowTradeType = 'sweep' | 'block' | 'split' | 'trade'
export type FlowAggressor = 'ask' | 'bid' | 'mid'

export interface FlowPrint {
  id: string
  time: string // ISO timestamp
  symbol: string
  sector: string
  side: FlowSide
  strike: number
  expiration: string // ISO date
  dte: number
  otmPercent: number // signed: negative = ITM, positive = OTM
  spotAtTrade: number
  price: number // option premium per contract ($)
  premium: number // total notional premium ($) = price * size * 100
  size: number // contracts
  openInterest: number
  volume: number
  iv: number // percent
  delta: number // signed, -1..1
  tradeType: FlowTradeType
  aggressor: FlowAggressor
  moveSincePercent: number // underlying move % since the print
  repeat: number // how many prints at this strike/expiry in the window (sweep legs etc.)
}

// --- Gamma Heat Map: strike x expiry board with per-expiry Flowster levels ---

export interface GammaHeatmapColumn {
  date: string // ISO date
  label: string // "08/24"
  dte: number
  isNearest: boolean
  attraction: number // this expiry's Attraction (pin) price
  wall: number // this expiry's Call Wall price
  move: number // this expiry's Implied Move band edge
}

export interface GammaHeatmapRow {
  strike: number
  values: (number | null)[] // net GEX $ per column, aligned to columns
  net: number // aggregate net GEX $ across all expiries
  netPct: number // 0-100, |net| as a share of the board's largest row
  trendUp: boolean // synthetic intraday momentum direction for the net badge
  trendPct: number // 0-100
  isSpot: boolean
  isFlip: boolean // Gamma Flip strike
  isReversal: boolean // Reversal-risk strike
  isAttraction: boolean // dominant Attraction (pin) strike
  moveBand: '1x' | '1.5x' | '2x' | null // implied-move multiple this strike sits on
}

export interface GammaHeatmap {
  symbol: string
  spot: number
  updatedMinutesAgo: number
  columns: GammaHeatmapColumn[]
  rows: GammaHeatmapRow[]
  maxCellAbs: number // for cell color scaling
  maxNetAbs: number // for net bar scaling
  metrics: GexBoardMetrics
  live: boolean
}
