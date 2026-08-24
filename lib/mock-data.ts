import type {
  AccountInfo,
  ActivitySummary,
  Candle,
  FlowAggressor,
  FlowPrint,
  FlowSide,
  FlowSummary,
  FlowTradeType,
  GammaCell,
  GammaColumn,
  GammaHeatmap,
  GammaHeatmapColumn,
  GammaHeatmapRow,
  GexBoardMetrics,
  HeatCell,
  KeyLevel,
  PriceNode,
  Signal,
  Ticker,
  Timeframe,
  TradePlan,
} from './types'

// --- Deterministic pseudo-random helpers (stable across SSR/CSR) ---
function seeded(seed: number) {
  let s = seed % 2147483647
  if (s <= 0) s += 2147483646
  return () => {
    s = (s * 16807) % 2147483647
    return (s - 1) / 2147483646
  }
}

function makeSpark(seed: number, trend: number): number[] {
  const rnd = seeded(seed)
  const out: number[] = []
  let v = 50
  for (let i = 0; i < 24; i++) {
    v += (rnd() - 0.5) * 8 + trend
    out.push(Math.max(5, Math.min(95, v)))
  }
  return out
}

interface Seed {
  symbol: string
  name: string
  price: number
  changePercent: number
}

const RAW: Seed[] = [
  { symbol: 'SPY', name: 'SPDR S&P 500 ETF Trust', price: 585.42, changePercent: 0.45 },
  { symbol: 'QQQ', name: 'Nasdaq 100 ETF', price: 505.18, changePercent: -0.39 },
  { symbol: 'IWM', name: 'Russell 2000 ETF', price: 225.67, changePercent: 1.59 },
  { symbol: 'DIA', name: 'Dow Jones ETF', price: 428.93, changePercent: 1.16 },
  { symbol: 'SPX', name: 'S&P 500 Index', price: 5854.2, changePercent: 0.41 },
  { symbol: 'TSLA', name: 'Tesla Inc', price: 249.13, changePercent: -0.83 },
  { symbol: 'NVDA', name: 'NVIDIA Corp', price: 131.85, changePercent: 2.21 },
  { symbol: 'AAPL', name: 'Apple Inc', price: 193.12, changePercent: 0.29 },
  { symbol: 'AMD', name: 'Advanced Micro', price: 162.33, changePercent: 1.21 },
  { symbol: 'META', name: 'Meta Platforms', price: 591.16, changePercent: 0.88 },
  { symbol: 'MSFT', name: 'Microsoft Corp', price: 428.9, changePercent: -0.22 },
  { symbol: 'NFLX', name: 'Netflix Inc', price: 762.45, changePercent: 1.44 },
  { symbol: 'AMZN', name: 'Amazon.com', price: 201.78, changePercent: 0.53 },
  { symbol: 'GOOGL', name: 'Alphabet Inc', price: 176.21, changePercent: -0.31 },
  { symbol: 'COIN', name: 'Coinbase Global', price: 268.5, changePercent: 3.62 },
  { symbol: 'MSTR', name: 'MicroStrategy', price: 342.9, changePercent: 4.18 },
  { symbol: 'PLTR', name: 'Palantir Tech', price: 64.12, changePercent: -1.07 },
  { symbol: 'AVGO', name: 'Broadcom Inc', price: 178.66, changePercent: 0.94 },
  { symbol: 'SMCI', name: 'Super Micro', price: 42.18, changePercent: -2.31 },
  { symbol: 'HOOD', name: 'Robinhood Markets', price: 115.6, changePercent: 0.06 },
  { symbol: 'GLD', name: 'Gold ETF', price: 251.34, changePercent: 0.27 },
  { symbol: 'TLT', name: '20Y Treasury ETF', price: 92.11, changePercent: -0.44 },
  { symbol: 'VIX', name: 'Volatility Index', price: 15.82, changePercent: -3.12 },
]

export const TICKERS: Ticker[] = RAW.map((r, i) => {
  const change = +(r.price * (r.changePercent / 100)).toFixed(2)
  const bias =
    r.changePercent > 0.4
      ? 'bullish'
      : r.changePercent < -0.4
        ? 'bearish'
        : 'neutral'
  return {
    ...r,
    change,
    bias,
    spark: makeSpark(i * 97 + 13, r.changePercent / 4),
  }
})

export function getTicker(symbol: string): Ticker {
  return TICKERS.find((t) => t.symbol === symbol) ?? TICKERS[0]
}

export const TICKER_SYMBOLS = TICKERS.map((t) => t.symbol)

// Symbol -> company name lookup, used to label live API quotes.
export const TICKER_NAMES: Record<string, string> = Object.fromEntries(
  RAW.map((r) => [r.symbol, r.name]),
)

// Symbols shown in the top ticker tape. Includes indexes (SPX) and the full
// requested watchlist so every provided ticker is reachable from the header.
export const TAPE_SYMBOLS = [
  'SPY',
  'QQQ',
  'SPX',
  'IWM',
  'DIA',
  'TSLA',
  'NVDA',
  'AAPL',
  'AMD',
  'META',
  'MSFT',
  'AMZN',
  'GOOGL',
  'HOOD',
  'COIN',
  'MSTR',
  'PLTR',
  'AVGO',
  'NFLX',
  'GLD',
  'VIX',
]

export const ACCOUNT: AccountInfo = {
  broker: 'Tradier',
  buyingPower: 25430.2,
  dayPnl: 342.18,
  dayPnlPct: 1.36,
}

// Human-readable expirations shown in the instrument bar dropdown.
export const EXPIRY_OPTIONS = [
  'Jun 27, 2025 (W)',
  'Jul 03, 2025 (W)',
  'Jul 11, 2025 (M)',
  'Jul 18, 2025 (M)',
]

// Further-dated expirations spread the gamma nodes wider around spot.
function expiryFactor(expiration?: string): number {
  const idx = expiration ? EXPIRY_OPTIONS.indexOf(expiration) : 0
  return 1 + Math.max(0, idx) * 0.22
}

// Ordered high -> low. Offsets tuned so SPY matches the reference levels.
// Passing an expiration spreads the nodes wider for further-dated contracts.
export function getKeyLevels(symbol: string, expiration?: string): KeyLevel[] {
  const t = getTicker(symbol)
  const p = t.price
  const f = expiryFactor(expiration)
  const round = (n: number) => +n.toFixed(2)
  const defs: { label: KeyLevel['label']; kind: KeyLevel['kind']; off: number }[] =
    [
      { label: 'Reversal', kind: 'reversal', off: 0.0097 },
      { label: 'Continuation', kind: 'continuation', off: 0.00646 },
      { label: 'Attraction', kind: 'attraction', off: 0.00338 },
      { label: 'Buy Above', kind: 'buy-wall', off: -0.00055 },
      { label: 'Sell Below', kind: 'sell-wall', off: -0.0045 },
    ]
  return defs.map((d) => ({
    id: `${symbol}-${d.label}`,
    label: d.label,
    kind: d.kind,
    price: round(p + p * d.off * f),
  }))
}

export function getTradePlan(symbol: string): TradePlan {
  const t = getTicker(symbol)
  const levels = getKeyLevels(symbol)
  const buy = levels.find((l) => l.label === 'Buy Above')!
  const sell = levels.find((l) => l.label === 'Sell Below')!
  const att = levels.find((l) => l.label === 'Attraction')!
  const cont = levels.find((l) => l.label === 'Continuation')!
  const long = t.bias !== 'bearish'
  const entry = +(buy.price + 0.1).toFixed(2)
  const target1 = att.price
  // Size the stop so the setup carries a healthy ~2.7:1 reward-to-risk.
  const risk = (target1 - entry) / 2.7
  const stop = +(entry - risk).toFixed(2)
  const rr = +((target1 - entry) / (entry - stop)).toFixed(1)
  return {
    setup: long ? 'Long Setup' : 'Short Setup',
    entry,
    stop,
    target1,
    target2: cont.price,
    riskReward: Math.abs(rr),
    confidence: 84,
    option: `${Math.round(att.price)}C`,
    optionExpiry: 'Jun 27, 2025 (W)',
    positionSize: 12,
    positionPct: 1.25,
  }
}

export function getFlowSummary(symbol: string): FlowSummary {
  const t = getTicker(symbol)
  const seed = Math.round(t.price * 7) + 3
  return {
  netGamma1D: 1.25e9,
  netGammaW: 4.78e9,
    callPutFlow: 1.42,
    callPutBias: 'bullish',
    darkPool: 'bullish',
    putCallRatio: 0.71,
    impliedMoveW: 1.18,
    spark1D: makeSpark(seed, 0.4),
    sparkW: makeSpark(seed + 11, 0.6),
    sparkFlow: makeSpark(seed + 29, 0.3),
  }
}

// Gamma exposure grid for the dashboard Flow Map.
export function getGammaMap(symbol: string): {
  columns: GammaColumn[]
  strikes: number[]
  cells: GammaCell[]
} {
  const t = getTicker(symbol)
  const spot = Math.round(t.price)
  const columns: GammaColumn[] = [
    { label: 'Jun 25 (0D)', tag: '0D' },
    { label: 'Jun 26 (1D)', tag: '1D' },
    { label: 'Jun 27 (W)', tag: 'W', selected: true },
    { label: 'Jul 03 (W)', tag: 'W' },
    { label: 'Jul 11 (M)', tag: 'M' },
  ]
  const strikes: number[] = []
  for (let i = 5; i >= -4; i--) strikes.push(spot + i)

  const rnd = seeded(spot * 17 + 5)
  const cells: GammaCell[] = []
  strikes.forEach((strike) => {
    columns.forEach((_, col) => {
      const dist = strike - spot
      // Above spot leans sell (red), below spot leans buy (green).
      const base = -dist * 26
      const pressure = Math.max(
        -100,
        Math.min(100, Math.round(base + (rnd() - 0.5) * 60)),
      )
      let special: GammaCell['special']
      if (strike === spot + 2 && (col === 2 || col === 1)) special = 'attraction'
      if (strike === spot - 2 && col === 2) special = 'attraction'
      if (strike === spot + 4 && col === 4) special = 'reversal'
      cells.push({ strike, col, pressure, special })
    })
  })
  return { columns, strikes, cells }
}

export function getDashboardInsight(
  symbol: string,
  expiration?: string,
): {
  text: string
  confidence: number
} {
  const t = getTicker(symbol)
  const levels = getKeyLevels(symbol, expiration)
  const att = levels.find((l) => l.label === 'Attraction')!
  const buy = levels.find((l) => l.label === 'Buy Above')!
  const rev = levels.find((l) => l.label === 'Reversal')!
  const bullish = t.bias !== 'bearish'
  const text = bullish
    ? `${symbol} is trading above the daily attraction node. Bias is bullish while price holds above ${buy.price.toFixed(
        2,
      )}. Next magnet is ${att.price.toFixed(
        2,
      )} with reversal risk near ${rev.price.toFixed(2)}.`
    : `${symbol} is trading below the daily attraction node. Bias is bearish while price stays under ${att.price.toFixed(
        2,
      )}. Downside magnet sits near ${buy.price.toFixed(2)}.`
  return { text, confidence: 84 }
}

export const EXPIRATIONS = [
  '2026-06-27',
  '2026-07-03',
  '2026-07-11',
  '2026-07-18',
  '2026-08-15',
  '2026-09-19',
]

// --- Price nodes per ticker (generated around spot) ---
export function getNodes(symbol: string): PriceNode[] {
  const t = getTicker(symbol)
  const p = t.price
  const round = (n: number) => +n.toFixed(2)
  const step = p * 0.012

  return [
    {
      id: `${symbol}-sw`,
      price: round(p + step * 4),
      kind: 'sell-wall',
      horizon: 'daily',
      label: 'Heavy Sell Wall',
      strength: 88,
    },
    {
      id: `${symbol}-rev-u`,
      price: round(p + step * 2.6),
      kind: 'reversal',
      horizon: 'weekly',
      label: 'Weekly Reversal',
      strength: 74,
    },
    {
      id: `${symbol}-att-w`,
      price: round(p + step * 1.2),
      kind: 'attraction',
      horizon: 'weekly',
      label: 'Weekly Attraction',
      strength: 92,
    },
    {
      id: `${symbol}-cont-u`,
      price: round(p + step * 0.5),
      kind: 'continuation',
      horizon: 'intraday',
      label: 'Continuation',
      strength: 61,
    },
    {
      id: `${symbol}-att-d`,
      price: round(p - step * 0.8),
      kind: 'attraction',
      horizon: 'daily',
      label: 'Daily Attraction',
      strength: 81,
    },
    {
      id: `${symbol}-cont-d`,
      price: round(p - step * 1.9),
      kind: 'continuation',
      horizon: 'daily',
      label: 'Continuation',
      strength: 55,
    },
    {
      id: `${symbol}-rev-d`,
      price: round(p - step * 2.8),
      kind: 'reversal',
      horizon: 'weekly',
      label: 'Weekly Reversal',
      strength: 70,
    },
    {
      id: `${symbol}-bw`,
      price: round(p - step * 4),
      kind: 'buy-wall',
      horizon: 'daily',
      label: 'Heavy Buy Wall',
      strength: 85,
    },
  ]
}

// --- Heatmap cells: strikes (rows) x expirations (cols) ---
export function getHeatmap(symbol: string): {
  strikes: number[]
  cells: HeatCell[]
} {
  const t = getTicker(symbol)
  const base = Math.round(t.price)
  const stepSize = Math.max(1, Math.round(t.price * 0.01))
  const strikes: number[] = []
  for (let i = 6; i >= -6; i--) {
    strikes.push(base + i * stepSize)
  }

  const rnd = seeded(base * 31 + 7)
  const cells: HeatCell[] = []
  strikes.forEach((strike, si) => {
    EXPIRATIONS.forEach((expiration, ei) => {
      // Pressure peaks near a couple of magnet strikes
      const distance = Math.abs(strike - t.price) / t.price
      const wave = Math.sin((si + ei) * 0.9) * 60
      const noise = (rnd() - 0.5) * 50
      let pressure = Math.round(wave + noise - distance * 120)
      pressure = Math.max(-100, Math.min(100, pressure))
      let label: string | undefined
      if (si === 2 && ei === 2) label = 'Weekly Attraction'
      else if (si === 4 && ei === 1) label = 'Daily Attraction'
      else if (si === 0 && ei === 3) label = 'Heavy Sell Wall'
      else if (si === strikes.length - 1 && ei === 0) label = 'Heavy Buy Wall'
      else if (si === 1 && ei === 4) label = 'Reversal'
      cells.push({ strike, expiration, pressure, label })
    })
  })
  return { strikes, cells }
}

// Per-timeframe character: higher timeframes mean fewer bars but bigger
// candles, so switching the timeframe visibly reshapes the chart.
const TF_PROFILE: Record<Timeframe, { vol: number; start: number; seed: number }> = {
  '1m': { vol: 0.004, start: 0.992, seed: 1 },
  '3m': { vol: 0.006, start: 0.99, seed: 2 },
  '5m': { vol: 0.01, start: 0.985, seed: 3 },
  '10m': { vol: 0.013, start: 0.982, seed: 4 },
  '15m': { vol: 0.016, start: 0.978, seed: 5 },
  '30m': { vol: 0.02, start: 0.972, seed: 6 },
  '1h': { vol: 0.026, start: 0.965, seed: 7 },
  daily: { vol: 0.034, start: 0.95, seed: 8 },
  weekly: { vol: 0.045, start: 0.93, seed: 9 },
}

// --- Candles for the price chart ---
export function getCandles(
  symbol: string,
  count = 60,
  timeframe: Timeframe = '5m',
): Candle[] {
  const t = getTicker(symbol)
  const prof = TF_PROFILE[timeframe]
  const rnd = seeded(Math.round(t.price * 13) + 5 + prof.seed * 101)
  const out: Candle[] = []
  let close = t.price * prof.start
  // Seconds-per-bar for the given timeframe so the TradingView time scale spaces
  // synthetic bars realistically ending "now".
  const TF_SECONDS: Record<string, number> = {
    '1m': 60,
    '3m': 180,
    '5m': 300,
    '10m': 600,
    '15m': 900,
    '30m': 1800,
    '1h': 3600,
    daily: 86400,
    weekly: 604800,
  }
  const step = TF_SECONDS[timeframe] ?? 300
  const base = Math.floor(Date.now() / 1000 / step) * step
  for (let i = 0; i < count; i++) {
    const open = close
    const drift = (rnd() - 0.48) * t.price * prof.vol
    close = +(open + drift).toFixed(2)
    const high = +(Math.max(open, close) + rnd() * t.price * prof.vol * 0.5).toFixed(2)
    const low = +(Math.min(open, close) - rnd() * t.price * prof.vol * 0.5).toFixed(2)
    out.push({
      time: `${String(9 + Math.floor(i / 12)).padStart(2, '0')}:${String(
        (i % 12) * 5,
      ).padStart(2, '0')}`,
      epoch: base - (count - 1 - i) * step,
      open,
      high,
      low,
      close,
    })
  }
  // nudge final close toward live price
  out[out.length - 1].close = t.price
  return out
}

export const RECENT_SIGNALS: Signal[] = [
  {
    id: 's1',
    symbol: 'TSLA',
    type: 'buy',
    level: 246,
    time: '2m ago',
    note: 'Broke above daily attraction and holding. Flow turned green.',
  },
  {
    id: 's2',
    symbol: 'NVDA',
    type: 'continuation',
    level: 136,
    time: '8m ago',
    note: 'Pushed through 136 continuation node with strong pressure.',
  },
  {
    id: 's3',
    symbol: 'SPY',
    type: 'sell',
    level: 585,
    time: '14m ago',
    note: 'Lost the weekly attraction at 585. Bias flipped bearish.',
  },
  {
    id: 's4',
    symbol: 'COIN',
    type: 'reversal',
    level: 272,
    time: '21m ago',
    note: 'Rejected the sell wall at 272 and faded lower.',
  },
  {
    id: 's5',
    symbol: 'AAPL',
    type: 'sell',
    level: 228,
    time: '33m ago',
    note: 'Rejected daily attraction; pressure rolling red.',
  },
  {
    id: 's6',
    symbol: 'MSTR',
    type: 'buy',
    level: 338,
    time: '47m ago',
    note: 'Reclaimed weekly attraction with green continuation.',
  },
]

export const ALL_ALERTS: Signal[] = [
  ...RECENT_SIGNALS,
  {
    id: 's7',
    symbol: 'QQQ',
    type: 'continuation',
    level: 496,
    time: '1h ago',
    note: 'Held above 496 continuation node; trend intact.',
  },
  {
    id: 's8',
    symbol: 'NVDA',
    type: 'reversal',
    level: 140,
    time: '1h ago',
    note: 'Tagged weekly reversal at 140 and stalled.',
  },
  {
    id: 's9',
    symbol: 'AMD',
    type: 'buy',
    level: 160,
    time: '2h ago',
    note: 'Reclaimed daily attraction with green pressure.',
  },
  {
    id: 's10',
    symbol: 'META',
    type: 'continuation',
    level: 588,
    time: '2h ago',
    note: 'Broke through 588 and holding the continuation.',
  },
  {
    id: 's11',
    symbol: 'PLTR',
    type: 'sell',
    level: 65,
    time: '3h ago',
    note: 'Lost daily attraction at 65; flow rolled red.',
  },
  {
    id: 's12',
    symbol: 'GOOGL',
    type: 'reversal',
    level: 178,
    time: '3h ago',
    note: 'Rejected sell wall near 178 and faded.',
  },
]

export const TODAY_ACTIVITY: ActivitySummary = {
  signalsTriggered: 38,
  nodesUpdated: 124,
  reversalAlerts: 9,
  continuationAlerts: 15,
}

// --- Voltick AI summaries per ticker ---
export function getAiSummary(symbol: string): string {
  const t = getTicker(symbol)
  const nodes = getNodes(symbol)
  const att = nodes.find((n) => n.kind === 'attraction' && n.horizon === 'weekly')!
  const rev = nodes.find((n) => n.kind === 'reversal' && n.price > t.price)!
  const below = t.price < att.price
  if (below) {
    return `${symbol} is trading below the weekly attraction node at ${att.price.toFixed(
      2,
    )}. Bias is bearish unless price reclaims ${att.price.toFixed(
      0,
    )}. Reversal risk near ${rev.price.toFixed(0)}.`
  }
  return `${symbol} is holding above the weekly attraction node at ${att.price.toFixed(
    2,
  )}. Bias stays bullish while price defends ${att.price.toFixed(
    0,
  )}. Watch the sell wall near ${rev.price.toFixed(0)}.`
}

// --- Unusual options flow (per-print feed) + market-wide heat map ---
//
// Both surfaces need a broader ticker universe than the header tape, so this
// extends (without mutating) the RAW watchlist with additional large caps.
// Sector tags drive the "All sectors" filter and the heat map grouping.

const SECTOR_MAP: Record<string, string> = {
  SPY: 'Index / ETF',
  QQQ: 'Index / ETF',
  IWM: 'Index / ETF',
  DIA: 'Index / ETF',
  SPX: 'Index / ETF',
  GLD: 'Commodities',
  TLT: 'Fixed Income',
  VIX: 'Volatility',
  TSLA: 'Consumer Discretionary',
  NVDA: 'Semiconductors',
  AMD: 'Semiconductors',
  AVGO: 'Semiconductors',
  SMCI: 'Semiconductors',
  INTC: 'Semiconductors',
  AAPL: 'Mega Cap Tech',
  MSFT: 'Mega Cap Tech',
  GOOGL: 'Mega Cap Tech',
  AMZN: 'Mega Cap Tech',
  META: 'Mega Cap Tech',
  NFLX: 'Media & Comm.',
  ORCL: 'Software',
  CRM: 'Software',
  ADBE: 'Software',
  PLTR: 'Software',
  COIN: 'Fintech / Crypto',
  MSTR: 'Fintech / Crypto',
  HOOD: 'Fintech / Crypto',
  JPM: 'Financials',
  UNH: 'Healthcare',
  LLY: 'Healthcare',
  PFE: 'Healthcare',
  XOM: 'Energy',
  CVX: 'Energy',
  DIS: 'Media & Comm.',
  BA: 'Industrials',
  WMT: 'Consumer Staples',
  KO: 'Consumer Staples',
  UBER: 'Consumer Discretionary',
  SHOP: 'Consumer Discretionary',
  SNAP: 'Media & Comm.',
  MU: 'Semiconductors',
}

const HEATMAP_EXTRA: Seed[] = [
  { symbol: 'JPM', name: 'JPMorgan Chase', price: 243.6, changePercent: 0.62 },
  { symbol: 'UNH', name: 'UnitedHealth Group', price: 570.28, changePercent: -1.14 },
  { symbol: 'LLY', name: 'Eli Lilly', price: 812.45, changePercent: 1.05 },
  { symbol: 'PFE', name: 'Pfizer Inc', price: 27.34, changePercent: -0.28 },
  { symbol: 'XOM', name: 'Exxon Mobil', price: 118.9, changePercent: 0.41 },
  { symbol: 'CVX', name: 'Chevron Corp', price: 158.22, changePercent: 0.33 },
  { symbol: 'DIS', name: 'Walt Disney Co', price: 111.7, changePercent: -0.52 },
  { symbol: 'BA', name: 'Boeing Co', price: 178.05, changePercent: 2.04 },
  { symbol: 'WMT', name: 'Walmart Inc', price: 92.43, changePercent: 0.18 },
  { symbol: 'KO', name: 'Coca-Cola Co', price: 71.16, changePercent: -0.09 },
  { symbol: 'ORCL', name: 'Oracle Corp', price: 198.4, changePercent: 1.72 },
  { symbol: 'CRM', name: 'Salesforce Inc', price: 302.11, changePercent: -0.68 },
  { symbol: 'ADBE', name: 'Adobe Inc', price: 456.9, changePercent: -1.31 },
  { symbol: 'UBER', name: 'Uber Technologies', price: 76.22, changePercent: 1.9 },
  { symbol: 'SHOP', name: 'Shopify Inc', price: 108.5, changePercent: 2.63 },
  { symbol: 'SNAP', name: 'Snap Inc', price: 11.62, changePercent: -2.87 },
  { symbol: 'MU', name: 'Micron Technology', price: 118.34, changePercent: 3.05 },
]

/** Full flow/heat-map universe: the header tape plus the extra large caps above. */
export const FLOW_UNIVERSE: Ticker[] = [
  ...TICKERS,
  ...HEATMAP_EXTRA.map((r) => {
    const change = +(r.price * (r.changePercent / 100)).toFixed(2)
    const bias =
      r.changePercent > 0.4 ? 'bullish' : r.changePercent < -0.4 ? 'bearish' : 'neutral'
    return { ...r, change, bias, spark: makeSpark(r.symbol.length * 53 + 11, r.changePercent / 4) } as Ticker
  }),
]

export function sectorOf(symbol: string): string {
  return SECTOR_MAP[symbol] ?? 'Other'
}

export const FLOW_SECTORS = Array.from(
  new Set(FLOW_UNIVERSE.map((t) => sectorOf(t.symbol))),
).sort()

const TRADE_TYPE_WEIGHTS: [FlowTradeType, number][] = [
  ['trade', 46],
  ['sweep', 32],
  ['block', 17],
  ['split', 5],
]

function weightedPick<T>(rnd: () => number, weights: [T, number][]): T {
  const total = weights.reduce((s, [, w]) => s + w, 0)
  let r = rnd() * total
  for (const [v, w] of weights) {
    r -= w
    if (r <= 0) return v
  }
  return weights[weights.length - 1][0]
}

// Rough Black-Scholes-flavored premium estimate — good enough to look
// realistic without needing a real pricing engine for mock data.
function estimatePremium(spot: number, strike: number, dte: number, iv: number, side: FlowSide) {
  const t = Math.max(dte, 0.5) / 365
  const moneyness = side === 'call' ? spot - strike : strike - spot
  const intrinsic = Math.max(0, moneyness)
  const timeValue = spot * (iv / 100) * Math.sqrt(t) * 0.4
  const extra = Math.exp(-Math.abs(moneyness) / (spot * 0.06 + 1)) * timeValue
  const price = intrinsic * 0.55 + extra + 0.05
  return Math.max(0.03, +price.toFixed(2))
}

function pickSizeAndTrade(rnd: () => number): { size: number; tradeType: FlowTradeType } {
  const tradeType = weightedPick(rnd, TRADE_TYPE_WEIGHTS)
  // Power-law-ish size distribution: mostly small prints, occasional whales.
  const base = Math.pow(rnd(), 2.6)
  const scale = tradeType === 'block' ? 24000 : tradeType === 'sweep' ? 14000 : 6000
  const size = Math.max(50, Math.round(50 + base * scale))
  return { size, tradeType }
}

let flowSeq = 0

function makeFlowPrint(rnd: () => number, minutesAgo: number): FlowPrint {
  const universe = FLOW_UNIVERSE
  // Weight the first dozen (index/mega-cap/high-flow names) more heavily so
  // they dominate the feed the way they do in real unusual-flow scanners.
  const idx = Math.floor(Math.pow(rnd(), 1.6) * universe.length)
  const t = universe[Math.min(universe.length - 1, idx)]
  const spot = t.price

  const side: FlowSide = rnd() < 0.52 ? 'call' : 'put'
  const dteBucket = weightedPick(rnd, [
    [0, 22],
    [1, 12],
    [3, 16],
    [7, 18],
    [14, 14],
    [30, 12],
    [60, 6],
  ] as [number, number][])
  const dte = Math.max(0, dteBucket + Math.floor(rnd() * 3))
  const expiration = new Date(Date.now() + dte * 86_400_000).toISOString().slice(0, 10)

  const otmSign = side === 'call' ? 1 : -1
  const otmMag = Math.pow(rnd(), 1.8) * 0.16 * (dte < 2 ? 1.6 : 1) // short-dated flow skews further OTM
  const otmPercent = +(otmSign * otmMag * 100).toFixed(1)
  const strikeRaw = spot * (1 + (otmSign * otmMag))
  const step = spot > 400 ? 5 : spot > 100 ? 1 : spot > 20 ? 0.5 : 0.25
  const strike = Math.round(strikeRaw / step) * step

  const iv = +(18 + rnd() * 70).toFixed(1)
  const price = estimatePremium(spot, strike, dte, iv, side)
  const { size, tradeType } = pickSizeAndTrade(rnd)
  const premium = Math.round(price * size * 100)

  const deltaMag = Math.max(0.02, Math.min(0.98, 0.5 - otmMag * 2.2))
  const delta = +((side === 'call' ? deltaMag : -deltaMag)).toFixed(2)

  const aggressor: FlowAggressor = weightedPick(rnd, [
    ['ask', 58],
    ['bid', 30],
    ['mid', 12],
  ] as [FlowAggressor, number][])

  const bullishPrint = (side === 'call' && aggressor === 'ask') || (side === 'put' && aggressor === 'bid')
  const moveSincePercent = +(((rnd() - (bullishPrint ? 0.32 : 0.68)) * 6)).toFixed(2)

  const openInterest = Math.round(size * (1.5 + rnd() * 6))
  const volume = Math.round(size * (1 + rnd() * 1.4))

  const time = new Date(Date.now() - minutesAgo * 60_000).toISOString()

  flowSeq += 1
  return {
    id: `flow-${flowSeq}-${t.symbol}-${Math.round(rnd() * 1e6)}`,
    time,
    symbol: t.symbol,
    sector: sectorOf(t.symbol),
    side,
    strike,
    expiration,
    dte,
    otmPercent,
    spotAtTrade: spot,
    price,
    premium,
    size,
    openInterest,
    volume,
    iv,
    delta,
    tradeType,
    aggressor,
    moveSincePercent,
    repeat: tradeType === 'sweep' ? 2 + Math.floor(rnd() * 5) : 1,
  }
}

/** A deterministic page of unusual-options-flow prints, newest first. */
export function getOptionsFlow(count = 140): FlowPrint[] {
  const rnd = seeded(count * 733 + 91)
  const prints: FlowPrint[] = []
  let minutesAgo = 0
  for (let i = 0; i < count; i++) {
    minutesAgo += rnd() * 2.4
    prints.push(makeFlowPrint(rnd, minutesAgo))
  }
  return prints
}

/** One fresh print "just now" — used to simulate a live streaming tape client-side. */
export function makeLiveFlowPrint(): FlowPrint {
  const rnd = seeded(Date.now() % 2147483646)
  return makeFlowPrint(rnd, rnd() * 0.15)
}

// --- Gamma Heat Map: strike x expiry board, self-contained (no live feed) ---

export const HEATMAP_STRIKE_COUNTS = [30, 50, 100, 150] as const
export type HeatmapStrikeCount = (typeof HEATMAP_STRIKE_COUNTS)[number]

/** Next N weekdays as ISO dates, starting today. */
function nextWeekdays(count: number): string[] {
  const out: string[] = []
  const d = new Date()
  while (out.length < count) {
    const day = d.getUTCDay()
    if (day !== 0 && day !== 6) out.push(d.toISOString().slice(0, 10))
    d.setUTCDate(d.getUTCDate() + 1)
  }
  return out
}

/**
 * A single-symbol strike x expiry gamma board, generated locally so the Heat
 * Map page always has something rich to show even without a live options
 * feed configured. Shaped like the live GexBoard (same GexBoardMetrics), with
 * added per-expiry Attraction/Wall/Move annotations and per-strike Flowster
 * level badges (Spot, Gamma Flip, Attraction, Reversal, implied-move bands).
 */
export function getGammaHeatmap(symbol: string, strikeCount: HeatmapStrikeCount = 50): GammaHeatmap {
  const t = getTicker(symbol)
  const spot = t.price
  const rnd = seeded(Math.round(spot * 101) + strikeCount * 7 + symbol.length * 53 + 17)

  const dates = nextWeekdays(9)
  const columns: GammaHeatmapColumn[] = dates.map((date, i) => {
    const spread = spot * (0.004 + i * 0.0032)
    return {
      date,
      label: new Date(date + 'T00:00:00Z').toLocaleDateString('en-US', {
        month: '2-digit',
        day: '2-digit',
        timeZone: 'UTC',
      }),
      dte: i,
      isNearest: i === 0,
      attraction: +(spot + (rnd() - 0.5) * spread * 2).toFixed(2),
      wall: +(spot + (rnd() - 0.5) * spread * 2.4).toFixed(2),
      move: +(spot + (rnd() - 0.4) * spread * 3.2).toFixed(1),
    }
  })

  const step = spot > 400 ? 1 : spot > 100 ? 0.5 : spot > 20 ? 0.25 : 0.1
  const spotStrike = +(Math.round(spot / step) * step).toFixed(2)
  const half = Math.max(1, Math.floor(strikeCount / 2))
  const strikes = Array.from({ length: half * 2 + 1 }, (_, i) =>
    +(spotStrike + (half - i) * step).toFixed(2),
  ).slice(0, strikeCount)

  // The "pin": a strike a few ticks above spot that carries the heaviest
  // negative gamma, decaying outward and flipping positive at the wings —
  // mirrors a typical dealer-short-gamma profile around current price.
  const pinStrike = spotStrike + step * (2 + Math.floor(rnd() * 2))
  const peakMag = spot * 9000 * (0.8 + rnd() * 0.6)

  const raw = strikes.map((strike) => {
    const distFromPin = strike - pinStrike
    const values = columns.map((c) => {
      const colScale = c.dte === 0 ? 1 : 1 / (1 + c.dte * 2.1)
      const decay = Math.exp(-Math.abs(distFromPin) / (step * 6))
      let v = -peakMag * decay * colScale
      if (distFromPin > step * 5) v = Math.abs(v) * 0.55 // call-side wing flips supportive
      if (strike < spotStrike - step * 7) v = Math.abs(v) * 0.4 // deep put wall support
      v += (rnd() - 0.5) * peakMag * 0.12 * colScale
      return Math.round(v)
    })
    const net = values.reduce((s, v) => s + (v ?? 0), 0)
    return { strike, values, net }
  })

  const maxCellAbs = Math.max(1, ...raw.flatMap((r) => r.values.map((v) => Math.abs(v ?? 0))))
  const maxNetAbs = Math.max(1, ...raw.map((r) => Math.abs(r.net)))

  const byAbsNet = [...raw].sort((a, b) => Math.abs(b.net) - Math.abs(a.net))
  const attractionStrike = byAbsNet[0]?.strike ?? pinStrike
  const reversalStrike = byAbsNet[1]?.strike ?? pinStrike + step
  // The zero-gamma crossover sits just past where the formula's own sign
  // flip kicks in above the pin — always close to price, never off in the
  // wings, regardless of noise elsewhere on the board.
  const flipTarget = +(pinStrike + step * 6).toFixed(2)
  const flipRow = raw.reduce((best, r) => (Math.abs(r.strike - flipTarget) < Math.abs(best.strike - flipTarget) ? r : best), raw[0])
  const putWallRow = [...raw].filter((r) => r.strike < spotStrike).sort((a, b) => a.net - b.net)[0]
  const growerRow = [...raw].sort((a, b) => b.net - a.net)[0]
  const netGex = raw.reduce((s, r) => s + r.net, 0)
  const move = +(spot * 0.0047 * (1 + rnd() * 0.3)).toFixed(2)

  const rows: GammaHeatmapRow[] = raw.map((r) => {
    const emMultiple = Math.abs(r.strike - spot) / (move || 1)
    // Only flag strikes that sit right on a 1x/1.5x/2x implied-move ring —
    // a sparse handful of badges, not one on every row.
    const halfStep = step / 2 / (move || 1)
    const band = [1, 1.5, 2].find((b) => Math.abs(emMultiple - b) <= Math.max(0.12, halfStep))
    const moveBand: GammaHeatmapRow['moveBand'] = band ? (`${band}x` as GammaHeatmapRow['moveBand']) : null
    return {
      strike: r.strike,
      values: r.values,
      net: r.net,
      netPct: Math.round((Math.abs(r.net) / maxNetAbs) * 100),
      trendUp: rnd() > 0.42,
      trendPct: Math.round(8 + rnd() * 45),
      isSpot: r.strike === spotStrike,
      isFlip: r.strike === flipRow.strike,
      isReversal: r.strike === reversalStrike,
      isAttraction: r.strike === attractionStrike,
      moveBand,
    }
  })

  const metrics: GexBoardMetrics = {
    netGex,
    putWall: putWallRow?.strike ?? spotStrike - step * 6,
    callWall: attractionStrike,
    zeroDte: attractionStrike,
    gammaFlip: flipRow.strike,
    grower: { strike: growerRow?.strike ?? spotStrike, share: Math.round(40 + rnd() * 55) },
    move,
    atmIv: +(14 + rnd() * 10).toFixed(1),
    regime: netGex >= 0 ? 'positive' : 'negative',
  }

  return {
    symbol,
    spot,
    updatedMinutesAgo: Math.round(rnd() * 20),
    columns,
    rows,
    maxCellAbs,
    maxNetAbs,
    metrics,
    live: false,
  }
}
