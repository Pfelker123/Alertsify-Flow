import "server-only"

import { uwFetch, num } from "./client"
import {
  getTicker as mockTicker,
  getKeyLevels as mockLevels,
  getFlowSummary as mockSummary,
  getGammaMap as mockGamma,
  getHeatmap as mockHeatmap,
  getNodes as mockNodes,
  getDashboardInsight as mockInsight,
  getAiSummary as mockAiSummary,
  getCandles as mockCandles,
  getTradePlan as mockTradePlan,
  TICKER_NAMES,
  RECENT_SIGNALS,
} from "@/lib/mock-data"
import type {
  Bias,
  Candle,
  FlowSummary,
  GammaCell,
  GammaColumn,
  GexBoard,
  GexBoardColumn,
  GexBoardRow,
  HeatCell,
  KeyLevel,
  PriceNode,
  Signal,
  SignalType,
  Ticker,
  Timeframe,
  TradePlan,
} from "@/lib/types"

export interface InstrumentData {
  ticker: Ticker
  levels: KeyLevel[]
  summary: FlowSummary
  gamma: { columns: GammaColumn[]; strikes: number[]; cells: GammaCell[] }
  nodes: PriceNode[]
  heatmap: { strikes: number[]; cells: HeatCell[] }
  insight: { text: string; confidence: number }
  aiSummary: string
  tradePlan: TradePlan
  live: boolean
}

// Build a trade plan from live key levels + spot (mirrors the mock logic but
// uses real GEX-derived levels).
function buildTradePlan(
  sym: string,
  ticker: Ticker,
  levels: KeyLevel[],
  summary: FlowSummary,
): TradePlan {
  const find = (label: KeyLevel["label"]) =>
    levels.find((l) => l.label === label)
  const buy = find("Buy Above")
  const att = find("Attraction")
  const cont = find("Continuation")
  if (!buy || !att || !cont) return mockTradePlan(sym)

  const long = ticker.bias !== "bearish"
  const entry = +(buy.price + buy.price * 0.0002).toFixed(2)
  const target1 = att.price
  const risk = Math.abs(target1 - entry) / 2.7 || entry * 0.003
  const stop = +(entry - risk).toFixed(2)
  const rr = +(Math.abs(target1 - entry) / Math.abs(entry - stop || 1)).toFixed(1)
  const conf = Math.round(
    72 +
      (summary.callPutBias === "bullish" ? 8 : summary.callPutBias === "bearish" ? -4 : 0) +
      Math.min(10, Math.abs(summary.callPutFlow - 1) * 8),
  )
  return {
    setup: long ? "Long Setup" : "Short Setup",
    entry,
    stop,
    target1,
    target2: cont.price,
    riskReward: Math.abs(rr),
    confidence: Math.max(50, Math.min(96, conf)),
    option: `${Math.round(att.price)}${long ? "C" : "P"}`,
    optionExpiry: "Nearest weekly",
    positionSize: 12,
    positionPct: 1.25,
  }
}

function biasFromChange(pct: number): Bias {
  return pct > 0.4 ? "bullish" : pct < -0.4 ? "bearish" : "neutral"
}

function makeSpark(seed: number, trend: number): number[] {
  let s = seed % 2147483647
  if (s <= 0) s += 2147483646
  const rnd = () => {
    s = (s * 16807) % 2147483647
    return (s - 1) / 2147483646
  }
  const out: number[] = []
  let v = 50
  for (let i = 0; i < 24; i++) {
    v += (rnd() - 0.5) * 8 + trend
    out.push(Math.max(5, Math.min(95, v)))
  }
  return out
}

// Turn a numeric series into a normalised 0-100 sparkline.
function normalizeSpark(values: number[]): number[] {
  if (!values.length) return makeSpark(7, 0.2)
  const lo = Math.min(...values)
  const hi = Math.max(...values)
  const span = hi - lo || 1
  return values.map((v) => 5 + ((v - lo) / span) * 90)
}

// ---------------- Quotes ----------------

interface StockState {
  close?: string
  prev_close?: string
  high?: string
  low?: string
  open?: string
  volume?: string | number
}

export async function fetchQuote(symbol: string): Promise<Ticker> {
  const sym = symbol.toUpperCase()
  try {
    const state = await uwFetch<StockState | StockState[]>(
      `/api/stock/${sym}/stock-state`,
      {},
      20,
    )
    const s = Array.isArray(state) ? state[0] : state
    const price = num(s?.close)
    const prev = num(s?.prev_close, price)
    if (!price) throw new Error("no price")
    const change = +(price - prev).toFixed(2)
    const changePercent = prev ? +((change / prev) * 100).toFixed(2) : 0
    return {
      symbol: sym,
      name: TICKER_NAMES[sym] ?? sym,
      price,
      change,
      changePercent,
      bias: biasFromChange(changePercent),
      spark: makeSpark(Math.round(price * 7) + 3, changePercent / 4),
    }
  } catch {
    return mockTicker(sym)
  }
}

export async function fetchQuotes(symbols: string[]): Promise<Ticker[]> {
  return Promise.all(symbols.map((s) => fetchQuote(s)))
}

// ---------------- Candles ----------------

const TF_TO_CANDLE: Record<Timeframe, string> = {
  "1m": "1m",
  "3m": "5m",
  "5m": "5m",
  "10m": "10m",
  "15m": "15m",
  "30m": "30m",
  "1h": "1h",
  daily: "1d",
  weekly: "1w",
}

interface UWCandle {
  open: string
  high: string
  low: string
  close: string
  start_time?: string
  volume?: number
}

export async function fetchCandles(
  symbol: string,
  timeframe: Timeframe,
): Promise<Candle[]> {
  const sym = symbol.toUpperCase()
  const size = TF_TO_CANDLE[timeframe] ?? "5m"
  const intraday = !["1d", "1w"].includes(size)
  try {
    const rows = await uwFetch<UWCandle[]>(
      `/api/stock/${sym}/ohlc/${size}`,
      { limit: 120 },
      20,
    )
    if (!Array.isArray(rows) || rows.length === 0) throw new Error("no candles")
    // API returns newest-first; sort oldest-first and keep last ~90 bars.
    const sorted = [...rows]
      .sort((a, b) => (a.start_time ?? "").localeCompare(b.start_time ?? ""))
      .slice(-90)
    return sorted.map((c) => {
      const d = c.start_time ? new Date(c.start_time) : null
      const time = d
        ? intraday
          ? d.toLocaleTimeString("en-US", {
              hour: "2-digit",
              minute: "2-digit",
              hour12: false,
              timeZone: "America/New_York",
            })
          : d.toLocaleDateString("en-US", { month: "short", day: "numeric" })
        : ""
      return {
        time,
        epoch: d ? Math.floor(d.getTime() / 1000) : 0,
        open: num(c.open),
        high: num(c.high),
        low: num(c.low),
        close: num(c.close),
      }
    })
  } catch {
    return mockCandles(sym, 78, timeframe)
  }
}

// ---------------- Greek exposure by strike ----------------

interface GexStrike {
  strike: string
  call_gex?: string
  put_gex?: string
  call_delta?: string
  put_delta?: string
}

async function fetchGexByStrike(sym: string): Promise<
  { strike: number; callGex: number; putGex: number; net: number }[]
> {
  const rows = await uwFetch<GexStrike[]>(
    `/api/stock/${sym}/greek-exposure/strike`,
    {},
    60,
  )
  if (!Array.isArray(rows) || rows.length === 0) return []
  return rows
    .map((r) => {
      const callGex = num(r.call_gex)
      const putGex = num(r.put_gex)
      return { strike: num(r.strike), callGex, putGex, net: callGex + putGex }
    })
    .filter((r) => r.strike > 0)
    .sort((a, b) => a.strike - b.strike)
}

// ---------------- Key levels (from GEX structure) ----------------

export async function fetchKeyLevels(
  sym: string,
  spot: number,
): Promise<KeyLevel[]> {
  const gex = await fetchGexByStrike(sym)
  if (gex.length < 4) return mockLevels(sym)

  const above = gex.filter((g) => g.strike >= spot)
  const below = gex.filter((g) => g.strike < spot)

  const maxBy = <T>(arr: T[], f: (x: T) => number): T | undefined =>
    arr.length ? arr.reduce((m, x) => (f(x) > f(m) ? x : m)) : undefined

  // Largest call gamma above spot => resistance / reversal wall.
  const callWall = maxBy(above, (g) => g.callGex)?.strike ?? spot * 1.01
  // Largest put gamma (abs) below spot => support / breakdown wall.
  const putWall = maxBy(below, (g) => Math.abs(g.putGex))?.strike ?? spot * 0.99
  // Gamma pin: strike with the greatest total absolute gamma (magnet).
  const pin =
    maxBy(gex, (g) => Math.abs(g.net))?.strike ??
    +((callWall + putWall) / 2).toFixed(2)

  // Intermediate continuation / support between spot and the walls.
  const cont = +((spot + callWall) / 2).toFixed(2)
  const buyAbove = +((spot + putWall) / 2).toFixed(2)

  const raw: { label: KeyLevel["label"]; kind: KeyLevel["kind"]; price: number }[] =
    [
      { label: "Reversal", kind: "reversal", price: +callWall.toFixed(2) },
      { label: "Continuation", kind: "continuation", price: cont },
      { label: "Attraction", kind: "attraction", price: +pin.toFixed(2) },
      { label: "Buy Above", kind: "buy-wall", price: buyAbove },
      { label: "Sell Below", kind: "sell-wall", price: +putWall.toFixed(2) },
    ]
  // Sort high -> low for display, but keep each level bound to its OWN
  // calculated price/label (never reassign labels by position).
  raw.sort((a, b) => b.price - a.price)
  return raw.map((r) => ({
    id: `${sym}-${r.label}`,
    label: r.label,
    kind: r.kind,
    price: r.price,
  }))
}

// ---------------- Flow summary ----------------

interface OptionsVolume {
  call_volume?: number
  put_volume?: number
  call_premium?: string
  put_premium?: string
  bullish_premium?: string
  bearish_premium?: string
  net_call_premium?: string
  net_put_premium?: string
}

interface GreekExposureRow {
  call_gamma?: string
  put_gamma?: string
  date?: string
}

interface NetPremTick {
  net_call_premium?: string
  net_put_premium?: string
  net_volume?: number
  net_call_volume?: number
  net_delta?: string
}

interface IvRow {
  days?: number
  implied_move_perc?: string
}

export async function fetchFlowSummary(sym: string): Promise<FlowSummary> {
  try {
    const [volArr, gexArr, ticks, iv] = await Promise.all([
      uwFetch<OptionsVolume[]>(`/api/stock/${sym}/options-volume`, {}, 30).catch(
        () => [] as OptionsVolume[],
      ),
      uwFetch<GreekExposureRow[]>(`/api/stock/${sym}/greek-exposure`, {}, 60).catch(
        () => [] as GreekExposureRow[],
      ),
      uwFetch<NetPremTick[]>(`/api/stock/${sym}/net-prem-ticks`, {}, 30).catch(
        () => [] as NetPremTick[],
      ),
      uwFetch<IvRow[]>(`/api/stock/${sym}/interpolated-iv`, {}, 120).catch(
        () => [] as IvRow[],
      ),
    ])

    const vol = (Array.isArray(volArr) ? volArr[0] : volArr) ?? {}
    const callVol = num(vol.call_volume)
    const putVol = num(vol.put_volume)
    const callPrem = num(vol.call_premium)
    const putPrem = num(vol.put_premium)
    const bullish = num(vol.bullish_premium)
    const bearish = num(vol.bearish_premium)

    const putCallRatio = callVol ? +(putVol / callVol).toFixed(2) : 0.7
    const callPutFlow = putPrem ? +(callPrem / putPrem).toFixed(2) : 1
    const callPutBias: Bias =
      callPrem > putPrem * 1.05
        ? "bullish"
        : putPrem > callPrem * 1.05
          ? "bearish"
          : "neutral"
    const darkPool: Bias =
      bullish > bearish * 1.05
        ? "bullish"
        : bearish > bullish * 1.05
          ? "bearish"
          : "neutral"

    // Net gamma in raw dollars (call_gamma + already-negative put_gamma).
    // The UI formatter auto-scales to K/M/B. 1D = latest day, W = 5-day sum.
    const gex = Array.isArray(gexArr) ? gexArr : []
    const netAt = (r?: GreekExposureRow) =>
      r ? num(r.call_gamma) + num(r.put_gamma) : 0
    const netGamma1D = netAt(gex[0])
    const wSlice = gex.slice(0, 5)
    const netGammaW = wSlice.length
      ? wSlice.reduce((a, r) => a + netAt(r), 0)
      : netGamma1D

    // Implied weekly move from interpolated IV (~5 DTE bucket).
    const ivRows = Array.isArray(iv) ? iv : []
    const wk =
      ivRows.find((r) => num(r.days) >= 5 && num(r.days) <= 7) ?? ivRows[1] ?? ivRows[0]
    const impliedMoveW = wk ? +(num(wk.implied_move_perc) * 100).toFixed(2) : 1.2

    // Real sparklines built from the per-minute net premium ticks.
    const tickArr = Array.isArray(ticks) ? ticks.slice(-40) : []
    let cumCall = 0
    const callSeries = tickArr.map((t) => (cumCall += num(t.net_call_premium)))
    let cumNet = 0
    const netSeries = tickArr.map(
      (t) => (cumNet += num(t.net_call_premium) + num(t.net_put_premium)),
    )
    const volSeries = tickArr.map((t) => num(t.net_volume) || num(t.net_call_volume))

    const seed = Math.round((callPrem || 1) % 99999) + 3
    return {
      netGamma1D,
      netGammaW,
      callPutFlow,
      callPutBias,
      darkPool,
      putCallRatio,
      impliedMoveW,
      spark1D: callSeries.length ? normalizeSpark(callSeries) : makeSpark(seed, 0.4),
      sparkW: netSeries.length ? normalizeSpark(netSeries) : makeSpark(seed + 11, 0.5),
      sparkFlow: volSeries.length
        ? normalizeSpark(volSeries)
        : makeSpark(seed + 29, 0.3),
    }
  } catch {
    return mockSummary(sym)
  }
}

// ---------------- Gamma map / heatmap (strike x expiry) ----------------

interface GexStrikeExpiry {
  strike: string
  expiry: string
  call_gex?: string
  put_gex?: string
}

function tagFor(expiry: string): GammaColumn["tag"] {
  const d = new Date(expiry + "T00:00:00Z")
  const days = Math.round((d.getTime() - Date.now()) / 86_400_000)
  if (days <= 0) return "0D"
  if (days === 1) return "1D"
  if (days <= 9) return "W"
  return "M"
}

function fmtCol(expiry: string): string {
  const d = new Date(expiry + "T00:00:00Z")
  const label = d.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  })
  return `${label} (${tagFor(expiry)})`
}

// Shared strike x expiry gamma grid for the gamma map + heatmap.
// The `/greek-exposure/strike-expiry` endpoint only returns ONE expiry when
// called without an `expiry` param, so we resolve the nearest expiries first
// (from volume-oi-expiry) and then query each expiry explicitly. Returns a
// spot-centered strike list plus the per-cell net-gamma lookup.
async function fetchGexGrid(
  sym: string,
  spot: number,
  maxCols: number,
  maxRows: number,
): Promise<{
  expiries: string[]
  strikes: number[]
  byKey: Map<string, number>
  maxAbs: number
  pinStrike: number
}> {
  const exps = await uwFetch<VolOiExpiry[]>(
    `/api/stock/${sym}/option/volume-oi-expiry`,
    {},
    300,
  )
  const midnight = new Date()
  midnight.setUTCHours(0, 0, 0, 0)
  const expiries = (Array.isArray(exps) ? exps : [])
    .map((e) => e.expires ?? "")
    .filter(Boolean)
    .filter((e) => new Date(e + "T00:00:00Z").getTime() >= midnight.getTime())
    .sort()
    .slice(0, maxCols)

  const byKey = new Map<string, number>()
  const rowAbs = new Map<number, number>()
  let maxAbs = 1

  await Promise.all(
    expiries.map(async (expiry) => {
      const rows = await uwFetch<GexStrikeExpiry[]>(
        `/api/stock/${sym}/greek-exposure/strike-expiry`,
        { expiry },
        60,
      ).catch(() => [] as GexStrikeExpiry[])
      for (const r of Array.isArray(rows) ? rows : []) {
        const strike = num(r.strike)
        if (strike <= 0) continue
        const net = num(r.call_gex) + num(r.put_gex)
        byKey.set(`${strike}|${expiry}`, net)
        rowAbs.set(strike, (rowAbs.get(strike) ?? 0) + Math.abs(net))
        maxAbs = Math.max(maxAbs, Math.abs(net))
      }
    }),
  )

  const strikes = Array.from(rowAbs.keys())
    .sort((a, b) => Math.abs(a - spot) - Math.abs(b - spot))
    .slice(0, maxRows)
    .sort((a, b) => b - a)

  // Attraction pin = strike with the greatest total absolute gamma (magnet).
  let pinStrike = spot
  let pinVal = -Infinity
  for (const s of strikes) {
    const v = rowAbs.get(s) ?? 0
    if (v > pinVal) {
      pinVal = v
      pinStrike = s
    }
  }

  return { expiries, strikes, byKey, maxAbs, pinStrike }
}

export async function fetchGammaMap(
  sym: string,
  spot: number,
): Promise<{ columns: GammaColumn[]; strikes: number[]; cells: GammaCell[] }> {
  try {
    const { expiries, strikes, byKey, maxAbs, pinStrike } = await fetchGexGrid(
      sym,
      spot,
      5,
      10,
    )
    if (expiries.length < 2 || strikes.length < 4) return mockGamma(sym)

    const selectedCol = Math.min(2, expiries.length - 1)
    const columns: GammaColumn[] = expiries.map((e, i) => ({
      label: fmtCol(e),
      tag: tagFor(e),
      selected: i === selectedCol,
    }))
    const cells: GammaCell[] = []
    strikes.forEach((strike) => {
      expiries.forEach((expiry, col) => {
        const net = byKey.get(`${strike}|${expiry}`) ?? 0
        const pressure = Math.max(-100, Math.min(100, Math.round((net / maxAbs) * 100)))
        cells.push({ strike, col, pressure })
      })
    })
    // Mark the attraction magnet in the selected (middle) expiry column.
    const pinCell = cells.find(
      (c) => c.strike === pinStrike && c.col === selectedCol,
    )
    if (pinCell) pinCell.special = "attraction"

    return { columns, strikes, cells }
  } catch {
    return mockGamma(sym)
  }
}

export async function fetchHeatmap(
  sym: string,
  spot: number,
): Promise<{ strikes: number[]; cells: HeatCell[] }> {
  try {
    const { expiries, strikes, byKey, maxAbs } = await fetchGexGrid(
      sym,
      spot,
      6,
      13,
    )
    if (expiries.length < 2 || strikes.length < 4) return mockHeatmap(sym)

    const cells: HeatCell[] = []
    strikes.forEach((strike) => {
      expiries.forEach((expiration) => {
        const net = byKey.get(`${strike}|${expiration}`) ?? 0
        const pressure = Math.max(-100, Math.min(100, Math.round((net / maxAbs) * 100)))
        cells.push({ strike, expiration, pressure })
      })
    })
    return { strikes, cells }
  } catch {
    return mockHeatmap(sym)
  }
}

// ---------------- Detailed GEX board (Voltick-style strike x expiry) --------

interface VolOiExpiry {
  expires?: string
  volume?: number
  oi?: number
}

const BOARD_COLS = 6
const BOARD_ROWS = 26

function boardTag(expiry: string): GexBoardColumn["tag"] {
  const d = new Date(expiry + "T00:00:00Z")
  const days = Math.round((d.getTime() - Date.now()) / 86_400_000)
  if (days <= 0) return "0D"
  if (days === 1) return "1D"
  if (days <= 9) return "W"
  return "M"
}

function boardLabel(expiry: string): string {
  const d = new Date(expiry + "T00:00:00Z")
  return d.toLocaleDateString("en-US", {
    month: "2-digit",
    day: "2-digit",
    timeZone: "UTC",
  })
}

// Finds the strike (interpolated) where per-strike net gamma flips sign,
// choosing the crossover closest to spot. `rows` must be sorted ascending.
function gammaFlipFrom(
  rows: { strike: number; net: number }[],
  spot: number,
): number {
  let flip = spot
  let bestDist = Infinity
  for (let i = 1; i < rows.length; i++) {
    const a = rows[i - 1]
    const b = rows[i]
    if ((a.net <= 0 && b.net > 0) || (a.net >= 0 && b.net < 0)) {
      const span = b.net - a.net
      const cross =
        span === 0 ? a.strike : a.strike + ((0 - a.net) / span) * (b.strike - a.strike)
      const dist = Math.abs(cross - spot)
      if (dist < bestDist) {
        bestDist = dist
        flip = +cross.toFixed(2)
      }
    }
  }
  return flip
}

interface IvRow {
  date?: string
  days?: number
  volatility?: string
  implied_move_perc?: string
}

// Implied ATM vol + expected daily $ move from the interpolated IV surface.
async function fetchIvSummary(
  sym: string,
  spot: number,
): Promise<{ atmIv: number; move: number }> {
  try {
    const rows = await uwFetch<IvRow[]>(
      `/api/stock/${sym}/interpolated-iv`,
      {},
      60,
    )
    const arr = (Array.isArray(rows) ? rows : []).filter(
      (r) => (r.days ?? 0) >= 1,
    )
    if (!arr.length) throw new Error("no iv")
    arr.sort((a, b) => (a.days ?? 0) - (b.days ?? 0))
    const near = arr[0]
    return {
      atmIv: +(num(near.volatility) * 100).toFixed(1),
      move: +(spot * num(near.implied_move_perc)).toFixed(2),
    }
  } catch {
    return { atmIv: 0, move: 0 }
  }
}

export async function fetchGexBoard(symbol: string): Promise<GexBoard> {
  const sym = symbol.toUpperCase()
  try {
    const quote = await fetchQuote(sym)
    const spot = quote.price
    if (!spot) throw new Error("no spot")

    // 1) Nearest expiries from the volume/OI-by-expiry endpoint.
    const exps = await uwFetch<VolOiExpiry[]>(
      `/api/stock/${sym}/option/volume-oi-expiry`,
      {},
      300,
    )
    const midnight = new Date()
    midnight.setUTCHours(0, 0, 0, 0)
    const expiries = (Array.isArray(exps) ? exps : [])
      .map((e) => e.expires ?? "")
      .filter(Boolean)
      .filter((e) => new Date(e + "T00:00:00Z").getTime() >= midnight.getTime())
      .sort()
      .slice(0, BOARD_COLS)
    if (expiries.length < 2) throw new Error("no expiries")

    // 2) Per-expiry dollar GEX by strike (call_gex + put_gex = net).
    const perExp = await Promise.all(
      expiries.map(async (expiry) => {
        const rows = await uwFetch<GexStrikeExpiry[]>(
          `/api/stock/${sym}/greek-exposure/strike-expiry`,
          { expiry },
          60,
        )
        const map = new Map<number, number>()
        for (const r of Array.isArray(rows) ? rows : []) {
          const strike = num(r.strike)
          if (strike > 0) map.set(strike, num(r.call_gex) + num(r.put_gex))
        }
        return { expiry, map }
      }),
    )

    // 3) True aggregate (all expiries) for the Net GEX column + walls + flip.
    const aggRows = await fetchGexByStrike(sym)
    const aggMap = new Map<number, number>(aggRows.map((r) => [r.strike, r.net]))
    if (aggMap.size < 6) throw new Error("sparse")

    // Displayed strikes: nearest to spot, high -> low.
    const strikes = Array.from(aggMap.keys())
      .sort((a, b) => Math.abs(a - spot) - Math.abs(b - spot))
      .slice(0, BOARD_ROWS)
      .sort((a, b) => b - a)

    const nearestStrike = strikes.reduce((m, s) =>
      Math.abs(s - spot) < Math.abs(m - spot) ? s : m,
    )

    let maxCellAbs = 1
    let maxNetAbs = 1
    const rows: GexBoardRow[] = strikes.map((strike) => {
      const values = perExp.map(({ map }) => {
        const v = map.has(strike) ? (map.get(strike) as number) : null
        if (v !== null) maxCellAbs = Math.max(maxCellAbs, Math.abs(v))
        return v
      })
      const net = aggMap.get(strike) ?? 0
      maxNetAbs = Math.max(maxNetAbs, Math.abs(net))
      return { strike, values, net, isSpot: strike === nearestStrike }
    })

    // --- Metrics from the full aggregate curve ---
    const netGex = aggRows.reduce((sum, r) => sum + r.net, 0)
    const above = aggRows.filter((r) => r.strike >= spot)
    const below = aggRows.filter((r) => r.strike < spot)
    const maxBy = <T>(arr: T[], f: (x: T) => number): T | undefined =>
      arr.length ? arr.reduce((m, x) => (f(x) > f(m) ? x : m)) : undefined

    const callWall =
      maxBy(above, (r) => r.callGex)?.strike ?? +(spot * 1.01).toFixed(0)
    const putWall =
      maxBy(below, (r) => Math.abs(r.putGex))?.strike ??
      +(spot * 0.99).toFixed(0)

    // 0DTE call wall: strongest positive net in the nearest expiry column.
    const nearMap = perExp[0]?.map ?? new Map<number, number>()
    let zeroDte = callWall
    let zBest = -Infinity
    for (const [strike, net] of nearMap) {
      if (net > zBest) {
        zBest = net
        zeroDte = strike
      }
    }

    // Gamma flip (zero-gamma level): the strike nearest spot where per-strike
    // net gamma changes sign. Restricted to a band around spot so a uniformly
    // positive/negative wing can't drag it to the chart edge.
    const band = aggRows
      .filter((r) => Math.abs(r.strike - spot) <= spot * 0.08)
      .sort((a, b) => a.strike - b.strike)
    let gammaFlip = gammaFlipFrom(band, spot)

    // Grower: strike with the largest positive gamma + its share of the total.
    const positives = aggRows.filter((r) => r.net > 0)
    const totalPos = positives.reduce((s, r) => s + r.net, 0) || 1
    const top = maxBy(positives, (r) => r.net)
    const grower = {
      strike: top?.strike ?? callWall,
      share: Math.round(((top?.net ?? 0) / totalPos) * 100),
    }

    const { atmIv, move } = await fetchIvSummary(sym, spot)

    const columns: GexBoardColumn[] = expiries.map((expiry) => ({
      label: boardLabel(expiry),
      tag: boardTag(expiry),
      expiry,
    }))

    return {
      symbol: sym,
      spot,
      columns,
      rows,
      maxCellAbs,
      maxNetAbs,
      metrics: {
        netGex,
        putWall,
        callWall,
        zeroDte,
        gammaFlip,
        grower,
        move,
        atmIv,
        regime: netGex >= 0 ? "positive" : "negative",
      },
      live: true,
    }
  } catch {
    return mockGexBoard(sym)
  }
}

// Synthetic board used when the live options endpoints are unavailable.
function mockGexBoard(sym: string): GexBoard {
  const spot = mockTicker(sym).price
  const rnd = seededBoard(Math.round(spot * 31) + 7)
  const step = spot > 400 ? 1 : spot > 100 ? 1 : 0.5
  const day = 86_400_000
  const base = Date.now()
  const columns: GexBoardColumn[] = Array.from({ length: BOARD_COLS }).map(
    (_, i) => {
      const d = new Date(base + [0, 1, 2, 5, 7, 30][i] * day)
      const iso = d.toISOString().slice(0, 10)
      return { label: boardLabel(iso), tag: boardTag(iso), expiry: iso }
    },
  )
  const center = Math.round(spot / step) * step
  const strikes = Array.from({ length: BOARD_ROWS }).map(
    (_, i) => +(center + (BOARD_ROWS / 2 - i) * step).toFixed(2),
  )
  let maxCellAbs = 1
  let maxNetAbs = 1
  const rows: GexBoardRow[] = strikes.map((strike) => {
    const dist = Math.abs(strike - spot) / (step * BOARD_ROWS)
    const bias = strike >= spot ? 1 : -1
    const values = columns.map(() => {
      const mag = (1 - dist) * 260_000_000 * (0.4 + rnd())
      const v = Math.round(bias * mag * (rnd() - 0.35))
      maxCellAbs = Math.max(maxCellAbs, Math.abs(v))
      return v as number | null
    })
    const net = (values as number[]).reduce((s, v) => s + (v ?? 0), 0)
    maxNetAbs = Math.max(maxNetAbs, Math.abs(net))
    return {
      strike,
      values,
      net,
      isSpot: Math.abs(strike - spot) < step / 2,
    }
  })
  const netGex = rows.reduce((s, r) => s + r.net, 0)
  return {
    symbol: sym,
    spot,
    columns,
    rows,
    maxCellAbs,
    maxNetAbs,
    metrics: {
      netGex,
      putWall: +(center - 6 * step).toFixed(2),
      callWall: +(center + 5 * step).toFixed(2),
      zeroDte: +(center + 2 * step).toFixed(2),
      gammaFlip: +(center - step).toFixed(2),
      grower: { strike: +(center + 3 * step).toFixed(2), share: 41 },
      move: +(spot * 0.006).toFixed(2),
      atmIv: 18.4,
      regime: netGex >= 0 ? "positive" : "negative",
    },
    live: false,
  }
}

// Tiny deterministic PRNG so the mock board stays stable between renders.
function seededBoard(seed: number): () => number {
  let s = seed % 2147483647
  if (s <= 0) s += 2147483646
  return () => {
    s = (s * 16807) % 2147483647
    return (s - 1) / 2147483646
  }
}

// ---------------- Nodes (from GEX walls) ----------------

export async function fetchNodes(sym: string, spot: number): Promise<PriceNode[]> {
  try {
    const gex = await fetchGexByStrike(sym)
    if (gex.length < 5) return mockNodes(sym)
    const maxAbs = Math.max(1, ...gex.map((g) => Math.abs(g.net)))
    // Take the most significant strikes by absolute gamma, nearest to spot.
    const ranked = [...gex]
      .sort((a, b) => Math.abs(b.net) - Math.abs(a.net))
      .slice(0, 8)
      .sort((a, b) => b.strike - a.strike)
    return ranked.map((g, i) => {
      const above = g.strike >= spot
      const strong = Math.abs(g.net) / maxAbs
      let kind: PriceNode["kind"]
      if (g.callGex > Math.abs(g.putGex)) {
        kind = above ? "sell-wall" : "continuation"
      } else {
        kind = above ? "reversal" : "buy-wall"
      }
      if (Math.abs(g.strike - spot) / spot < 0.004) kind = "attraction"
      const horizon: PriceNode["horizon"] =
        strong > 0.66 ? "weekly" : strong > 0.33 ? "daily" : "intraday"
      const labelMap: Record<PriceNode["kind"], string> = {
        "sell-wall": "Heavy Sell Wall",
        "buy-wall": "Heavy Buy Wall",
        reversal: "Reversal",
        continuation: "Continuation",
        attraction: "Attraction",
        spot: "Spot",
      }
      return {
        id: `${sym}-node-${i}`,
        price: +g.strike.toFixed(2),
        kind,
        horizon,
        label: labelMap[kind],
        strength: Math.round(40 + strong * 55),
      }
    })
  } catch {
    return mockNodes(sym)
  }
}

// ---------------- Insight text ----------------

function buildInsight(sym: string, ticker: Ticker, levels: KeyLevel[]) {
  const att = levels.find((l) => l.label === "Attraction")
  const buy = levels.find((l) => l.label === "Buy Above")
  const rev = levels.find((l) => l.label === "Reversal")
  if (!att || !buy || !rev) return mockInsight(sym)
  const bullish = ticker.bias !== "bearish"
  const text = bullish
    ? `${sym} is trading above the daily attraction node. Bias is bullish while price holds above ${buy.price.toFixed(2)}. Next magnet is ${att.price.toFixed(2)} with reversal risk near ${rev.price.toFixed(2)}.`
    : `${sym} is trading below the daily attraction node. Bias is bearish while price stays under ${att.price.toFixed(2)}. Downside magnet sits near ${buy.price.toFixed(2)}.`
  const confidence = Math.min(
    95,
    70 + Math.round(Math.abs(ticker.changePercent) * 6),
  )
  return { text, confidence }
}

function buildAiSummary(sym: string, ticker: Ticker, nodes: PriceNode[]): string {
  const att =
    nodes.find((n) => n.kind === "attraction") ??
    nodes.find((n) => n.horizon === "weekly")
  const rev = nodes.find((n) => n.kind === "reversal" && n.price > ticker.price)
  if (!att) return mockAiSummary(sym)
  const below = ticker.price < att.price
  const revTxt = rev ? ` Watch the wall near ${rev.price.toFixed(0)}.` : ""
  return below
    ? `${sym} is trading below the attraction node at ${att.price.toFixed(2)}. Bias is bearish unless price reclaims ${att.price.toFixed(0)}.${revTxt}`
    : `${sym} is holding above the attraction node at ${att.price.toFixed(2)}. Bias stays bullish while price defends ${att.price.toFixed(0)}.${revTxt}`
}

// ---------------- Aggregate instrument fetch ----------------

export async function fetchInstrument(symbol: string): Promise<InstrumentData> {
  const sym = symbol.toUpperCase()
  const ticker = await fetchQuote(sym)
  const spot = ticker.price

  const [levels, summary, gamma, nodes, heatmap] = await Promise.all([
    fetchKeyLevels(sym, spot),
    fetchFlowSummary(sym),
    fetchGammaMap(sym, spot),
    fetchNodes(sym, spot),
    fetchHeatmap(sym, spot),
  ])

  return {
    ticker,
    levels,
    summary,
    gamma,
    nodes,
    heatmap,
    insight: buildInsight(sym, ticker, levels),
    aiSummary: buildAiSummary(sym, ticker, nodes),
    tradePlan: buildTradePlan(sym, ticker, levels, summary),
    live: Boolean(process.env.UNUSUAL_WHALES_API_KEY),
  }
}

// ---------------- Flow alerts -> Signals ----------------

interface FlowAlert {
  ticker?: string
  type?: string
  strike?: string
  alert_rule?: string
  created_at?: string
  total_premium?: string
  total_size?: number
  underlying_price?: string
  volume_oi_ratio?: string
  has_sweep?: boolean
}

function relTime(iso?: string): string {
  if (!iso) return "just now"
  const diff = Date.now() - new Date(iso).getTime()
  const m = Math.round(diff / 60000)
  if (m < 1) return "just now"
  if (m < 60) return `${m}m ago`
  const h = Math.round(m / 60)
  if (h < 24) return `${h}h ago`
  return `${Math.round(h / 24)}d ago`
}

function fmtPrem(v: number): string {
  if (v >= 1e6) return `$${(v / 1e6).toFixed(1)}M`
  if (v >= 1e3) return `$${(v / 1e3).toFixed(0)}K`
  return `$${v.toFixed(0)}`
}

function signalTypeFor(a: FlowAlert): SignalType {
  const rule = (a.alert_rule ?? "").toLowerCase()
  const call = (a.type ?? "").toLowerCase() === "call"
  if (rule.includes("sweep") || a.has_sweep) return call ? "buy" : "sell"
  if (rule.includes("repeat")) return call ? "continuation" : "reversal"
  return call ? "buy" : "sell"
}

export async function fetchAlerts(symbol?: string, limit = 40): Promise<Signal[]> {
  try {
    const params: Record<string, string | number | boolean> = {
      limit,
      min_premium: 50_000,
    }
    if (symbol) params.ticker_symbol = symbol.toUpperCase()
    const rows = await uwFetch<FlowAlert[]>(
      `/api/option-trades/flow-alerts`,
      params,
      20,
    )
    if (!Array.isArray(rows) || rows.length === 0) throw new Error("no alerts")
    return rows.map((a, i) => {
      const type = signalTypeFor(a)
      const prem = fmtPrem(num(a.total_premium))
      const size = num(a.total_size)
      const kindWord =
        a.type?.toLowerCase() === "call" ? "calls" : "puts"
      return {
        id: `${a.ticker}-${a.strike}-${i}-${a.created_at ?? ""}`,
        symbol: a.ticker ?? "—",
        type,
        level: num(a.strike, num(a.underlying_price)),
        time: relTime(a.created_at),
        note: `${a.alert_rule ?? "Flow"} · ${size.toLocaleString()} ${kindWord} @ ${a.strike} · ${prem} premium`,
      }
    })
  } catch {
    return symbol
      ? RECENT_SIGNALS.filter((s) => s.symbol === symbol.toUpperCase())
      : RECENT_SIGNALS
  }
}
