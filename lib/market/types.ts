// Shared data-envelope contracts. Every server route that touches upstream
// market data returns a DataEnvelope so the UI always knows the provenance,
// freshness, and error state of what it renders. We never present generated
// or placeholder values as live.

export type DataSource = "live" | "delayed" | "stale" | "demo" | "unavailable"

export interface DataMeta {
  source: DataSource
  /** ISO timestamp of when this server response was produced. */
  fetchedAt: string
  /** ISO timestamp reported by the upstream market data, when available. */
  marketTimestamp?: string
  /** Age of the data in seconds at the moment the response was built. */
  ageSeconds: number
  /** The logical endpoint / dataset this envelope describes. */
  endpoint: string
  symbol?: string
  /** Human-readable upstream error message when source is unavailable. */
  error?: string
}

export interface DataEnvelope<T> {
  data: T | null
  meta: DataMeta
}

/** Freshness threshold (seconds) beyond which live data is considered stale. */
export const STALE_AFTER_SECONDS = 90

export function isDemoMode(): boolean {
  return process.env.FLOWSTERS_DEMO_MODE === "true"
}

/** Build a successful envelope. Downgrades live -> stale past the threshold. */
export function ok<T>(
  data: T,
  opts: {
    endpoint: string
    symbol?: string
    source?: DataSource
    marketTimestamp?: string
    fetchedAt?: string
  },
): DataEnvelope<T> {
  const fetchedAt = opts.fetchedAt ?? new Date().toISOString()
  const ageSeconds = Math.max(
    0,
    Math.round((Date.now() - new Date(fetchedAt).getTime()) / 1000),
  )
  let source: DataSource = opts.source ?? "live"
  if (source === "live" && ageSeconds > STALE_AFTER_SECONDS) source = "stale"
  return {
    data,
    meta: {
      source,
      fetchedAt,
      marketTimestamp: opts.marketTimestamp,
      ageSeconds,
      endpoint: opts.endpoint,
      symbol: opts.symbol,
    },
  }
}

/** Build a demo envelope (only ever used when FLOWSTERS_DEMO_MODE=true). */
export function demo<T>(
  data: T,
  opts: { endpoint: string; symbol?: string },
): DataEnvelope<T> {
  const fetchedAt = new Date().toISOString()
  return {
    data,
    meta: {
      source: "demo",
      fetchedAt,
      ageSeconds: 0,
      endpoint: opts.endpoint,
      symbol: opts.symbol,
    },
  }
}

/** Build an unavailable envelope carrying the real upstream error. */
export function unavailable<T = never>(opts: {
  endpoint: string
  symbol?: string
  error: string
}): DataEnvelope<T> {
  const fetchedAt = new Date().toISOString()
  return {
    data: null,
    meta: {
      source: "unavailable",
      fetchedAt,
      ageSeconds: 0,
      endpoint: opts.endpoint,
      symbol: opts.symbol,
      error: opts.error,
    },
  }
}
