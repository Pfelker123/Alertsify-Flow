import type {
  EngineInputs,
  EvidenceItem,
  Level,
  StrikeAnalytics,
  StrikeInput,
} from "./types"

/** Percentile rank (0-100) of `value` within `all` absolute magnitudes. */
export function percentileRank(value: number, all: number[]): number {
  if (!all.length) return 0
  const v = Math.abs(value)
  const below = all.filter((x) => Math.abs(x) <= v).length
  return Math.round((below / all.length) * 100)
}

/** Nearest expiration scope label from a strike's role. Chain-level scope. */
export function nearestScope(): "all" {
  // Strike-level GEX aggregates across expirations; scope is "all" here.
  return "all"
}

/** Build normalized, cumulative strike rows sorted ascending by strike. */
export function buildStrikeRows(
  strikes: StrikeInput[],
  spot: number,
): StrikeAnalytics[] {
  const sorted = [...strikes].sort((a, b) => a.strike - b.strike)
  let cumulative = 0
  return sorted.map((s) => {
    const netGex = s.callGex + s.putGex
    cumulative += netGex
    return {
      strike: s.strike,
      callGex: s.callGex,
      putGex: s.putGex,
      netGex,
      callOi: s.callOi ?? 0,
      putOi: s.putOi ?? 0,
      callVolume: s.callVolume ?? 0,
      putVolume: s.putVolume ?? 0,
      cumulativeNetGex: cumulative,
      distancePct: spot > 0 ? ((s.strike - spot) / spot) * 100 : 0,
    }
  })
}

/**
 * Call wall: the strike above spot with the largest positive call gamma.
 * Requires nonzero OI where OI data is available.
 */
export function computeCallWall(
  rows: StrikeAnalytics[],
  spot: number,
  allAbsCallGex: number[],
): Level | null {
  const candidates = rows.filter(
    (r) => r.strike > spot && r.callGex > 0 && (r.callOi > 0 || r.callOi === 0),
  )
  if (!candidates.length) return null
  const hasOi = candidates.some((c) => c.callOi > 0)
  const pool = hasOi ? candidates.filter((c) => c.callOi > 0) : candidates
  const top = pool.reduce((m, r) => (r.callGex > m.callGex ? r : m))
  return {
    id: `call-wall-${top.strike}`,
    type: "call-wall",
    price: top.strike,
    strength: percentileRank(top.callGex, allAbsCallGex),
    confidence: hasOi ? 85 : 65,
    expirationScope: "all",
    reason:
      "Strike above spot with the largest positive call gamma concentration; dealers hedge into it, creating resistance.",
    inputs: {
      callGex: Math.round(top.callGex),
      callOi: top.callOi,
      distancePct: +top.distancePct.toFixed(2),
    },
  }
}

/**
 * Put wall: the strike below spot with the largest absolute put gamma.
 */
export function computePutWall(
  rows: StrikeAnalytics[],
  spot: number,
  allAbsPutGex: number[],
): Level | null {
  const candidates = rows.filter((r) => r.strike < spot && Math.abs(r.putGex) > 0)
  if (!candidates.length) return null
  const hasOi = candidates.some((c) => c.putOi > 0)
  const pool = hasOi ? candidates.filter((c) => c.putOi > 0) : candidates
  const top = pool.reduce((m, r) =>
    Math.abs(r.putGex) > Math.abs(m.putGex) ? r : m,
  )
  return {
    id: `put-wall-${top.strike}`,
    type: "put-wall",
    price: top.strike,
    strength: percentileRank(top.putGex, allAbsPutGex),
    confidence: hasOi ? 85 : 65,
    expirationScope: "all",
    reason:
      "Strike below spot with the largest put gamma concentration; dealers hedge into it, creating support.",
    inputs: {
      putGex: Math.round(top.putGex),
      putOi: top.putOi,
      distancePct: +top.distancePct.toFixed(2),
    },
  }
}

/**
 * Gamma flip: the price where cumulative net GEX changes sign, found by
 * linear interpolation between adjacent strikes. Returns null (with a warning
 * upstream) when no sign change exists — we never invent a midpoint.
 */
export function computeGammaFlip(
  rows: StrikeAnalytics[],
  spot: number,
): { level: Level | null; warning?: string } {
  if (rows.length < 2) {
    return { level: null, warning: "Not enough strikes to compute a gamma flip." }
  }
  let best: { price: number; a: number; b: number } | null = null
  let bestDist = Infinity
  for (let i = 1; i < rows.length; i++) {
    const a = rows[i - 1]
    const b = rows[i]
    const ca = a.cumulativeNetGex
    const cb = b.cumulativeNetGex
    const signChange = (ca <= 0 && cb > 0) || (ca >= 0 && cb < 0)
    if (!signChange) continue
    const span = cb - ca
    const price =
      span === 0
        ? a.strike
        : a.strike + ((0 - ca) / span) * (b.strike - a.strike)
    const dist = Math.abs(price - spot)
    if (dist < bestDist) {
      bestDist = dist
      best = { price: +price.toFixed(2), a: a.strike, b: b.strike }
    }
  }
  if (!best) {
    return {
      level: null,
      warning:
        "Cumulative net GEX never changes sign across available strikes; no gamma flip could be computed.",
    }
  }
  return {
    level: {
      id: `gamma-flip-${best.price}`,
      type: "gamma-flip",
      price: best.price,
      strength: 100,
      confidence: 80,
      expirationScope: "all",
      reason:
        "Zero-crossing of cumulative net gamma exposure, interpolated between adjacent strikes. Above it dealers are long gamma (mean-reverting); below it short gamma (trend-amplifying).",
      inputs: {
        lowerStrike: best.a,
        upperStrike: best.b,
        interpolatedPrice: best.price,
      },
    },
  }
}

/** Composite 0-100 quality from which weighted inputs are present. */
export function computeDataQuality(inputs: EngineInputs): number {
  const w = { quote: 20, candles: 20, gexByStrike: 30, chain: 20, flow: 10 }
  let score = 0
  for (const [k, present] of Object.entries(inputs.inputStatus)) {
    if (present) score += w[k as keyof typeof w] ?? 0
  }
  return Math.min(100, Math.round(score))
}

export function baseEvidence(
  rows: StrikeAnalytics[],
  spot: number,
): EvidenceItem[] {
  const totalNet = rows.reduce((s, r) => s + r.netGex, 0)
  const totalCallOi = rows.reduce((s, r) => s + r.callOi, 0)
  const totalPutOi = rows.reduce((s, r) => s + r.putOi, 0)
  return [
    { label: "Strikes analyzed", detail: "Valid strikes with gamma data", value: rows.length },
    { label: "Net GEX (sum)", detail: "Aggregate dealer gamma across strikes", value: Math.round(totalNet) },
    {
      label: "Put/Call OI",
      detail: "Total open interest split",
      value: totalCallOi + totalPutOi > 0 ? `${totalPutOi.toLocaleString()} / ${totalCallOi.toLocaleString()}` : "n/a",
    },
    { label: "Spot", detail: "Reference price used for distances", value: spot },
  ]
}
