import "server-only"
import { uwFetch, num } from "./client"
import type { CandleInput, EngineInputs, FlowInput, StrikeInput } from "@/lib/analytics/types"
import type { HeatmapCell, HeatmapGrid, HeatmapMetric } from "@/lib/market/heatmap"

// Mock-free live data source. Every fetcher hits a real UW endpoint and throws
// on failure. Nothing here ever substitutes generated values. The analytics
// route decides how to present partial/missing data.

export interface QuoteData {
  symbol: string
  price: number
  change: number
  changePercent: number
  marketTimestamp?: string
}

interface StockState {
  close?: string
  prev_close?: string
  market_time?: string
  tape_time?: string
}

export async function rawQuote(sym: string): Promise<QuoteData> {
  const state = await uwFetch<StockState | StockState[]>(
    `/api/stock/${sym}/stock-state`,
    {},
    10,
  )
  const s = Array.isArray(state) ? state[0] : state
  const price = num(s?.close)
  if (!price) throw new Error("Quote returned no price")
  const prev = num(s?.prev_close, price)
  const change = +(price - prev).toFixed(2)
  return {
    symbol: sym,
    price,
    change,
    changePercent: prev ? +((change / prev) * 100).toFixed(2) : 0,
    marketTimestamp: s?.market_time ?? s?.tape_time,
  }
}

interface UWCandle {
  open: string
  high: string
  low: string
  close: string
  start_time?: string
  volume?: number
}

const TF_MAP: Record<string, string> = {
  "1m": "1m",
  "5m": "5m",
  "15m": "15m",
  "30m": "30m",
  "1h": "1h",
  daily: "1d",
  weekly: "1w",
}

export async function rawCandles(
  sym: string,
  timeframe = "5m",
): Promise<CandleInput[]> {
  const size = TF_MAP[timeframe] ?? "5m"
  const rows = await uwFetch<UWCandle[]>(
    `/api/stock/${sym}/ohlc/${size}`,
    { limit: 200 },
    10,
  )
  if (!Array.isArray(rows) || rows.length === 0) {
    throw new Error("No candle data")
  }
  return rows
    .filter((c) => c.start_time)
    .map((c) => ({
      epoch: Math.floor(new Date(c.start_time as string).getTime() / 1000),
      open: num(c.open),
      high: num(c.high),
      low: num(c.low),
      close: num(c.close),
      volume: typeof c.volume === "number" ? c.volume : num(c.volume),
    }))
    .filter((c) => c.epoch > 0 && c.close > 0)
    .sort((a, b) => a.epoch - b.epoch)
    .slice(-180)
}

interface GexStrikeRow {
  strike: string
  call_gex?: string
  put_gex?: string
}

export async function rawGexByStrike(sym: string): Promise<StrikeInput[]> {
  const rows = await uwFetch<GexStrikeRow[]>(
    `/api/stock/${sym}/greek-exposure/strike`,
    {},
    20,
  )
  if (!Array.isArray(rows) || rows.length === 0) {
    throw new Error("No gamma-by-strike data")
  }
  return rows
    .map((r) => ({
      strike: num(r.strike),
      callGex: num(r.call_gex),
      putGex: num(r.put_gex),
    }))
    .filter((r) => r.strike > 0)
    .sort((a, b) => a.strike - b.strike)
}

interface OptionsVolumeRow {
  call_volume?: number
  put_volume?: number
  call_premium?: string
  put_premium?: string
  bullish_premium?: string
  bearish_premium?: string
  net_call_premium?: string
  net_put_premium?: string
  call_open_interest?: number
  put_open_interest?: number
}

export interface AggregateChain {
  callVolume: number
  putVolume: number
  callOi: number
  putOi: number
  flow: FlowInput
}

export async function rawChainAggregate(sym: string): Promise<AggregateChain> {
  const rows = await uwFetch<OptionsVolumeRow[]>(
    `/api/stock/${sym}/options-volume`,
    {},
    15,
  )
  const r = Array.isArray(rows) ? rows[0] : (rows as OptionsVolumeRow)
  if (!r) throw new Error("No options-volume data")
  return {
    callVolume: num(r.call_volume),
    putVolume: num(r.put_volume),
    callOi: num(r.call_open_interest),
    putOi: num(r.put_open_interest),
    flow: {
      bullishPremium: num(r.bullish_premium),
      bearishPremium: num(r.bearish_premium),
      netCallPremium: num(r.net_call_premium),
      netPutPremium: num(r.net_put_premium),
    },
  }
}

interface ExpiryBreakdownRow {
  expires: string
  volume?: number | string
  open_interest?: number | string
  chains?: number | string
}

/** List of tradable expirations (nearest first) for the symbol. */
export async function rawExpiries(sym: string): Promise<string[]> {
  const rows = await uwFetch<ExpiryBreakdownRow[]>(
    `/api/stock/${sym}/expiry-breakdown`,
    {},
    120,
  )
  if (!Array.isArray(rows) || rows.length === 0) {
    throw new Error("No expiration breakdown available")
  }
  return rows
    .map((r) => r.expires)
    .filter(Boolean)
    .sort()
}

interface ContractRow {
  option_symbol: string
  open_interest?: number | string
  volume?: number | string
  implied_volatility?: number | string
}

/**
 * Parse an OCC option symbol like `SPY260717C00755000` into its parts.
 * Format: ROOT + YYMMDD + C/P + strike*1000 (8 digits).
 */
function parseOptionSymbol(
  sym: string,
): { expiry: string; type: "C" | "P"; strike: number } | null {
  const m = sym.match(/([0-9]{6})([CP])([0-9]{8})$/)
  if (!m) return null
  const [, ymd, cp, strikeRaw] = m
  const expiry = `20${ymd.slice(0, 2)}-${ymd.slice(2, 4)}-${ymd.slice(4, 6)}`
  return { expiry, type: cp as "C" | "P", strike: Number(strikeRaw) / 1000 }
}

/** Per-expiry option chain (real per-strike OI/volume/IV). */
async function rawContractsForExpiry(
  sym: string,
  expiry: string,
): Promise<ContractRow[]> {
  const rows = await uwFetch<ContractRow[]>(
    `/api/stock/${sym}/option-contracts`,
    { expiry, limit: 500 },
    25,
  )
  return Array.isArray(rows) ? rows : []
}

export interface HeatmapSource {
  expiries: string[]
  /** expiry -> contract rows */
  chains: Record<string, ContractRow[]>
}

/**
 * Build a real strike x expiration heatmap source. Fetches the nearest N
 * expirations and their full option chains in parallel. This is the data that
 * powers the Voltick-style grid: real per-strike, per-expiry open interest.
 */
export async function rawHeatmapSource(
  sym: string,
  maxExpiries = 6,
): Promise<HeatmapSource> {
  const all = await rawExpiries(sym)
  const expiries = all.slice(0, maxExpiries)
  const results = await Promise.allSettled(
    expiries.map((e) => rawContractsForExpiry(sym, e)),
  )
  const chains: Record<string, ContractRow[]> = {}
  results.forEach((r, i) => {
    if (r.status === "fulfilled") chains[expiries[i]] = r.value
  })
  const got = Object.keys(chains)
  if (got.length === 0) throw new Error("No option-chain data for any expiry")
  return { expiries: got.sort(), chains }
}

/**
 * Build the canonical heatmap grid from real per-expiry option chains.
 * Each cell aggregates real call/put OI and volume for a (strike, expiry).
 * A gamma proxy is derived from OI so the color scale reflects dealer
 * positioning even though the raw greek-exposure endpoint is single-expiry.
 * Strikes are windowed around spot so the grid stays readable and centered.
 */
export function buildHeatmap(
  sym: string,
  spot: number,
  source: HeatmapSource,
  strikeWindowPct = 6,
): HeatmapGrid {
  const cellMap = new Map<string, HeatmapCell>()
  const key = (s: number, e: string) => `${s}|${e}`

  for (const expiry of source.expiries) {
    for (const c of source.chains[expiry] ?? []) {
      const parsed = parseOptionSymbol(c.option_symbol)
      if (!parsed) continue
      const { strike, type } = parsed
      const distPct = spot ? (Math.abs(strike - spot) / spot) * 100 : 0
      if (distPct > strikeWindowPct) continue

      const oi = num(c.open_interest)
      const vol = num(c.volume)
      const k = key(strike, expiry)
      const cell =
        cellMap.get(k) ??
        ({
          strike,
          expiration: expiry,
          callGex: 0,
          putGex: 0,
          netGex: 0,
          callOi: 0,
          putOi: 0,
          callVolume: 0,
          putVolume: 0,
          liquidityScore: 0,
        } as HeatmapCell)

      if (type === "C") {
        cell.callOi += oi
        cell.callVolume += vol
      } else {
        cell.putOi += oi
        cell.putVolume += vol
      }
      cellMap.set(k, cell)
    }
  }

  // Gamma proxy: dealers are typically short calls / long puts, so net dealer
  // gamma at a strike scales with (callOI - putOI). Scale by spot^2 / 100 to
  // approximate dollar gamma magnitude for the color ramp.
  const gammaScale = (spot * spot) / 100
  const cells = Array.from(cellMap.values()).map((c) => {
    const callG = c.callOi * gammaScale
    const putG = -c.putOi * gammaScale
    c.callGex = callG
    c.putGex = putG
    c.netGex = callG + putG
    c.liquidityScore = c.callOi + c.putOi + c.callVolume + c.putVolume
    return c
  })

  const strikes = Array.from(new Set(cells.map((c) => c.strike))).sort(
    (a, b) => a - b,
  )
  const expirations = Array.from(new Set(cells.map((c) => c.expiration))).sort()

  return {
    symbol: sym,
    spot,
    strikes,
    expirations,
    cells,
    markers: [{ strike: nearestStrike(strikes, spot), kind: "spot" }],
    // Every metric here is derived from real per-expiry chain data.
    supportedMetrics: [
      "netGex",
      "callGex",
      "putGex",
      "callOi",
      "putOi",
    ] as HeatmapMetric[],
    dataTimestamp: new Date().toISOString(),
  }
}

function nearestStrike(strikes: number[], spot: number): number {
  if (!strikes.length) return spot
  return strikes.reduce((m, s) => (Math.abs(s - spot) < Math.abs(m - spot) ? s : m))
}

export interface GatheredData {
  quote: QuoteData | null
  candles: CandleInput[] | null
  strikes: StrikeInput[] | null
  chain: AggregateChain | null
  heatmapSource: HeatmapSource | null
  inputStatus: EngineInputs["inputStatus"]
  errors: Record<string, string>
}

/**
 * Fetch every required upstream dataset in parallel, tolerating partial
 * failure. Returns raw pieces plus a per-input status map and the real error
 * messages so the route can build an honest envelope.
 */
export async function gatherData(
  sym: string,
  timeframe = "5m",
): Promise<GatheredData> {
  const [quoteR, candlesR, strikesR, chainR, heatR] = await Promise.allSettled([
    rawQuote(sym),
    rawCandles(sym, timeframe),
    rawGexByStrike(sym),
    rawChainAggregate(sym),
    rawHeatmapSource(sym),
  ])

  const errors: Record<string, string> = {}
  const reason = (r: PromiseRejectedResult) =>
    r.reason instanceof Error ? r.reason.message : String(r.reason)

  const quote = quoteR.status === "fulfilled" ? quoteR.value : null
  if (quoteR.status === "rejected") errors.quote = reason(quoteR)

  const candles = candlesR.status === "fulfilled" ? candlesR.value : null
  if (candlesR.status === "rejected") errors.candles = reason(candlesR)

  const strikes = strikesR.status === "fulfilled" ? strikesR.value : null
  if (strikesR.status === "rejected") errors.gexByStrike = reason(strikesR)

  const chain = chainR.status === "fulfilled" ? chainR.value : null
  if (chainR.status === "rejected") errors.chain = reason(chainR)

  const heatmapSource = heatR.status === "fulfilled" ? heatR.value : null
  if (heatR.status === "rejected") errors.heatmap = reason(heatR)

  return {
    quote,
    candles,
    strikes,
    chain,
    heatmapSource,
    inputStatus: {
      quote: Boolean(quote),
      candles: Boolean(candles && candles.length > 1),
      gexByStrike: Boolean(strikes && strikes.length >= 4),
      chain: Boolean(chain),
      flow: Boolean(chain),
    },
    errors,
  }
}
