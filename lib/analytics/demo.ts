import type { CandleInput, EngineInputs, StrikeInput } from "./types"
import type { HeatmapGrid, HeatmapMetric } from "@/lib/market/heatmap"

// Deterministic demo generator. ONLY used when FLOWSTERS_DEMO_MODE=true. The
// output is clearly flagged source="demo" everywhere it surfaces so it can
// never be mistaken for live data. It runs through the real engine so the demo
// exercises the same code path as production.

function prng(seed: number): () => number {
  let s = seed % 2147483647
  if (s <= 0) s += 2147483646
  return () => ((s = (s * 16807) % 2147483647) - 1) / 2147483646
}

const DEMO_SPOT: Record<string, number> = {
  SPY: 585.42,
  QQQ: 505.18,
  IWM: 225.67,
  TSLA: 249.13,
  NVDA: 131.85,
  AAPL: 193.12,
}

export function demoSpot(sym: string): number {
  return DEMO_SPOT[sym] ?? 100 + (sym.charCodeAt(0) % 40) * 5
}

export function demoInputs(sym: string): {
  inputs: EngineInputs
  candles: CandleInput[]
} {
  const spot = demoSpot(sym)
  const rnd = prng(Math.round(spot * 97) + sym.length)
  const step = spot > 400 ? 5 : spot > 100 ? 2.5 : 1
  const center = Math.round(spot / step) * step

  const strikes: StrikeInput[] = Array.from({ length: 41 }).map((_, i) => {
    const strike = +(center + (i - 20) * step).toFixed(2)
    const dist = Math.abs(strike - spot) / (step * 20)
    const mag = (1 - dist) * 2.4e8 * (0.5 + rnd())
    // Positive call gamma above spot, negative put gamma below spot.
    const callGex = strike >= spot ? mag * (0.6 + rnd() * 0.6) : mag * 0.2 * rnd()
    const putGex = strike < spot ? -mag * (0.6 + rnd() * 0.6) : -mag * 0.2 * rnd()
    return {
      strike,
      callGex: Math.round(callGex),
      putGex: Math.round(putGex),
      callOi: Math.round((1 - dist) * 40000 * (0.5 + rnd())),
      putOi: Math.round((1 - dist) * 40000 * (0.5 + rnd())),
      callVolume: Math.round((1 - dist) * 15000 * rnd()),
      putVolume: Math.round((1 - dist) * 15000 * rnd()),
    }
  })

  const now = Math.floor(Date.now() / 1000)
  let price = spot * 0.996
  const candles: CandleInput[] = Array.from({ length: 120 }).map((_, i) => {
    const drift = (rnd() - 0.46) * step * 0.4
    const open = price
    price = +(price + drift).toFixed(2)
    const high = Math.max(open, price) + rnd() * step * 0.3
    const low = Math.min(open, price) - rnd() * step * 0.3
    return {
      epoch: now - (120 - i) * 300,
      open: +open.toFixed(2),
      high: +high.toFixed(2),
      low: +low.toFixed(2),
      close: +price.toFixed(2),
    }
  })

  return {
    inputs: {
      symbol: sym,
      spot,
      strikes,
      candles,
      flow: {
        bullishPremium: 8_400_000 * (0.5 + rnd()),
        bearishPremium: 6_100_000 * (0.5 + rnd()),
        netCallPremium: 2_300_000 * (rnd() - 0.4),
        netPutPremium: 1_800_000 * (rnd() - 0.4),
      },
      inputStatus: {
        quote: true,
        candles: true,
        gexByStrike: true,
        chain: true,
        flow: true,
      },
    },
    candles,
  }
}

export function demoHeatmap(sym: string): HeatmapGrid {
  const { inputs } = demoInputs(sym)
  const spot = inputs.spot
  const day = 86_400_000
  const base = Date.now()
  const expirations = [0, 1, 2, 5, 9, 30, 60].map((d) =>
    new Date(base + d * day).toISOString().slice(0, 10),
  )
  const rnd = prng(Math.round(spot * 13))
  const cells = inputs.strikes.flatMap((s) =>
    expirations.map((expiration, ei) => {
      const decay = 1 - ei / (expirations.length + 2)
      const callGex = Math.round(s.callGex * decay * (0.6 + rnd() * 0.5))
      const putGex = Math.round(s.putGex * decay * (0.6 + rnd() * 0.5))
      return {
        strike: s.strike,
        expiration,
        callGex,
        putGex,
        netGex: callGex + putGex,
        callOi: Math.round((s.callOi ?? 0) * decay),
        putOi: Math.round((s.putOi ?? 0) * decay),
        callVolume: Math.round((s.callVolume ?? 0) * decay),
        putVolume: Math.round((s.putVolume ?? 0) * decay),
        liquidityScore: Math.abs(callGex) + Math.abs(putGex),
      }
    }),
  )
  return {
    symbol: sym,
    spot,
    strikes: inputs.strikes.map((s) => s.strike),
    expirations,
    cells,
    markers: [{ strike: Math.round(spot), kind: "spot" }],
    supportedMetrics: ["netGex", "callGex", "putGex", "oi", "volume"] as HeatmapMetric[],
    dataTimestamp: new Date().toISOString(),
  }
}
