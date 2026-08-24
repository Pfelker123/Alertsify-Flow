import type { EngineInputs, FlowstersAnalytics, Level, LevelType } from "./types"
import {
  baseEvidence,
  buildStrikeRows,
  computeCallWall,
  computeDataQuality,
  computeGammaFlip,
  computePutWall,
} from "./gamma-engine"
import { computeScenarioTriggers } from "./node-engine"
import { buildFlowstersNodes } from "./flowsters-nodes"
import { reconcileNodes } from "./node-store"
import type { FlowstersNode, NodeState } from "./node-model"

export * from "./types"

/** Confidence 0-100 derived from a node's hysteresis state + data status. */
function stateConfidence(state: NodeState, dataStatus: string): number {
  const base =
    state === "strengthening"
      ? 90
      : state === "confirmed"
        ? 82
        : state === "emerging"
          ? 66
          : state === "weakening"
            ? 55
            : 50
  const penalty = dataStatus === "live" ? 0 : dataStatus === "delayed" ? 5 : 15
  return Math.max(0, Math.min(100, base - penalty))
}

/** Map a rich Flowsters node to the legacy Level contract for existing UI. */
function nodeToLevel(n: FlowstersNode, type: LevelType): Level {
  return {
    id: n.id,
    type,
    price: n.center,
    strength: n.strength,
    confidence: stateConfidence(n.state, n.dataStatus),
    expirationScope: n.timeframe === "intraday" ? "0dte" : n.timeframe,
    reason: n.reason,
    inputs: {
      state: n.state,
      structure: n.structure,
      direction: n.direction,
      strength: n.strength,
      distancePct: n.distancePct,
      crossExpirationCount: n.crossExpirationCount,
      persistenceUpdates: n.persistenceUpdates,
      netGex: n.netGex ?? 0,
    },
  }
}

/**
 * Pure analytics engine. Given already-fetched upstream inputs, compute the
 * single canonical analytics payload every surface consumes. Missing inputs
 * lower confidence and produce warnings rather than fabricated values.
 */
export function computeAnalytics(inputs: EngineInputs): FlowstersAnalytics {
  const { symbol, spot, strikes, candles, flow } = inputs
  const warnings: string[] = []

  const rows = buildStrikeRows(strikes, spot)
  const allAbsCallGex = rows.map((r) => r.callGex)
  const allAbsPutGex = rows.map((r) => r.putGex)

  if (!inputs.inputStatus.gexByStrike || rows.length < 4) {
    warnings.push(
      "Gamma-by-strike data is missing or too sparse; levels below are low-confidence or unavailable.",
    )
  }
  if (!inputs.inputStatus.flow) {
    warnings.push("Recent options flow unavailable; reversal confidence reduced.")
  }
  if (!inputs.inputStatus.candles) {
    warnings.push(
      "Candle history unavailable; continuation and scenario triggers cannot be confirmed.",
    )
  }

  const callWall = computeCallWall(rows, spot, allAbsCallGex)
  const putWall = computePutWall(rows, spot, allAbsPutGex)
  const flip = computeGammaFlip(rows, spot)
  if (flip.warning) warnings.push(flip.warning)

  // New node engine: build candidate nodes from the fresh strike analytics,
  // then reconcile them against the previous poll (in-memory store) to apply
  // consecutive-update confirmation and hysteresis. Nodes that no longer
  // qualify are removed instead of persisting for the session.
  const timeframe = inputs.timeframe ?? "daily"
  const candidateNodes = buildFlowstersNodes({
    symbol,
    spot,
    rows,
    candles,
    perExpiry: inputs.perExpiry,
    flow: flow
      ? { netCallPremium: flow.netCallPremium, netPutPremium: flow.netPutPremium }
      : null,
    timeframe,
    dataStatus: inputs.dataStatus ?? "live",
  })
  const nodes = reconcileNodes(symbol, timeframe, candidateNodes)

  // Derive the legacy Level arrays from the rich nodes so every existing
  // surface (chart pills, gamma levels, key levels) reflects the new
  // calculations without changing its own code.
  const attractionNodes = nodes
    .filter((n) => n.type === "attraction")
    .map((n) => nodeToLevel(n, "attraction"))
  // Reversal + dominant buy/sell walls are all "turn" levels for the chart.
  const reversalNodes = nodes
    .filter((n) => n.type === "reversal" || n.type === "buy_wall" || n.type === "sell_wall")
    .map((n) => nodeToLevel(n, "reversal"))
  const continuationNodes = nodes
    .filter((n) => n.type === "continuation")
    .map((n) => nodeToLevel(n, "continuation"))

  const { buyAbove, sellBelow } = computeScenarioTriggers(
    spot,
    candles,
    continuationNodes,
    reversalNodes,
  )

  return {
    symbol,
    spot,
    computedAt: new Date().toISOString(),
    dataQuality: computeDataQuality(inputs),
    gammaFlip: flip.level,
    callWall,
    putWall,
    attractionNodes,
    continuationNodes,
    reversalNodes,
    buyAbove,
    sellBelow,
    nodes,
    strikeRows: rows,
    evidence: baseEvidence(rows, spot),
    warnings,
  }
}

/**
 * Flatten the analytics into a single ordered list of levels for the chart.
 * Call/put walls are intentionally omitted here because they are represented
 * on the chart by the reversal (turn-level) nodes at the same strikes; the
 * walls remain in the payload for the Gamma Levels / Key Levels panels. Any
 * accidental duplicate prices are de-duplicated, keeping the first (higher
 * priority) level.
 */
export function allLevels(a: FlowstersAnalytics) {
  const ordered = [
    a.gammaFlip,
    ...a.reversalNodes,
    ...a.attractionNodes,
    ...a.continuationNodes,
    a.buyAbove,
    a.sellBelow,
  ].filter((l): l is NonNullable<typeof l> => l != null)

  const seen = new Set<number>()
  return ordered.filter((l) => {
    const key = Math.round(l.price * 100)
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
}
