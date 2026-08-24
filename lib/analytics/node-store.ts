// In-memory node store providing cross-update persistence and hysteresis.
//
// The analytics route recomputes candidate nodes on every poll. This store
// tracks each node across polls (keyed by a stable id) so we can:
//   - confirm nodes only after they survive several consecutive updates
//     (anti-flicker / emerging -> confirmed -> strengthening),
//   - keep a node briefly when it dips (weakening) instead of deleting it,
//   - retire and drop nodes that stop qualifying for good.
//
// It is a module-level singleton, so it survives across requests while the
// server process is warm. No database is used (per project architecture).

import type { FlowstersNode, NodeEngineConfig, NodeState } from "./node-model"
import { DEFAULT_NODE_CONFIG } from "./node-model"

interface StoredNode {
  node: FlowstersNode
  /** Consecutive updates the node has been present as a candidate. */
  hits: number
  /** Consecutive updates the node has been absent from candidates. */
  misses: number
  /** Last raw score, to detect strengthening vs weakening. */
  lastScore: number
}

interface SymbolBucket {
  nodes: Map<string, StoredNode>
  updatedAt: number
}

// key = `${symbol}:${timeframe}`
const store = new Map<string, SymbolBucket>()

// Buckets older than this are considered abandoned and discarded on access so
// a long-idle symbol can't resurrect stale state.
const BUCKET_TTL_MS = 10 * 60 * 1000

function bucketKey(symbol: string, timeframe: string): string {
  return `${symbol.toUpperCase()}:${timeframe}`
}

/**
 * Reconcile freshly computed candidate nodes with the previous snapshot,
 * applying consecutive-update confirmation and hysteresis. Returns the active
 * node set (states assigned), sorted by strength descending. Nodes that no
 * longer meet criteria are removed once they have been absent long enough.
 */
export function reconcileNodes(
  symbol: string,
  timeframe: string,
  candidates: FlowstersNode[],
  config: NodeEngineConfig = DEFAULT_NODE_CONFIG,
): FlowstersNode[] {
  const key = bucketKey(symbol, timeframe)
  const now = Date.now()
  const existing = store.get(key)
  const bucket: SymbolBucket =
    existing && now - existing.updatedAt <= BUCKET_TTL_MS
      ? existing
      : { nodes: new Map(), updatedAt: now }

  const { activation, removal } = config.thresholds
  const emergingN = config.thresholds.emergingConsecutiveUpdates
  const confirmedN = config.thresholds.confirmedConsecutiveUpdates
  const retireN = config.thresholds.retireConsecutiveUpdates

  // Track by a type-independent identity (the strike/center) so a level that
  // is re-classified across polls — e.g. a reversal promoted to a dominant
  // wall — updates the SAME tracked node instead of spawning a ghost of the
  // old type. Two levels never share a center within a timeframe.
  const trackKey = (n: FlowstersNode) => n.center.toFixed(2)

  const candidateIds = new Set(candidates.map(trackKey))
  const next = new Map<string, StoredNode>()

  // 1. Process candidates: update existing or introduce new ones.
  for (const cand of candidates) {
    const ckey = trackKey(cand)
    const prev = bucket.nodes.get(ckey)

    // Activation gate: a brand-new node must clear the activation threshold
    // before it is tracked at all. An already-tracked node survives until it
    // falls below the (lower) removal threshold — this gap is the hysteresis.
    if (!prev && cand.strength < activation) continue
    if (prev && cand.strength < removal) {
      // Falls into the "keep but weaken" path handled below via misses; treat
      // as absent this round so it decays rather than resetting its hits.
      continue
    }

    const hits = (prev?.hits ?? 0) + 1
    const rising = prev ? cand.rawScore >= prev.lastScore : true

    let state: NodeState
    if (hits < emergingN) state = "emerging"
    else if (hits < confirmedN) state = "confirmed"
    else state = rising ? "strengthening" : "confirmed"

    next.set(ckey, {
      node: {
        ...cand,
        state,
        persistenceUpdates: hits,
      },
      hits,
      misses: 0,
      lastScore: cand.rawScore,
    })
  }

  // 2. Decay previously tracked nodes that are absent (or dropped below
  //    removal) this round. They enter "weakening" and are retired after
  //    `retireN` consecutive misses.
  for (const [id, stored] of bucket.nodes) {
    if (next.has(id)) continue
    const misses = stored.misses + 1
    if (misses >= retireN) continue // retired -> dropped entirely
    next.set(id, {
      node: {
        ...stored.node,
        state: "weakening",
        updatedAt: new Date().toISOString(),
      },
      hits: 0,
      misses,
      lastScore: stored.lastScore,
    })
    void candidateIds
  }

  bucket.nodes = next
  bucket.updatedAt = now
  store.set(key, bucket)

  return Array.from(next.values())
    .map((s) => s.node)
    .sort((a, b) => b.strength - a.strength)
}

/** Test/util: clear a symbol's tracked state. */
export function clearNodeStore(symbol?: string, timeframe?: string): void {
  if (!symbol) {
    store.clear()
    return
  }
  if (timeframe) {
    store.delete(bucketKey(symbol, timeframe))
    return
  }
  for (const k of store.keys()) {
    if (k.startsWith(`${symbol.toUpperCase()}:`)) store.delete(k)
  }
}
