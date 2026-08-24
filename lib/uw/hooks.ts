"use client"

import useSWR from "swr"
import type { InstrumentData } from "@/lib/uw/service"
import type { Candle, GexBoard, Signal, Ticker, Timeframe } from "@/lib/types"
import type { DataEnvelope } from "@/lib/market/types"
import type { AnalyticsPayload } from "@/app/api/uw/analytics/[symbol]/route"

const fetcher = async (url: string) => {
  const res = await fetch(url)
  if (!res.ok) throw new Error(`Request failed: ${res.status}`)
  return res.json()
}

// Live market data polls on a short interval when auto-update is enabled.
const LIVE_MS = 30_000

export type AnalyticsEnvelope = DataEnvelope<AnalyticsPayload>

// Nodes must feel live, so the analytics envelope polls faster than the tape.
// Paired with the short server-side cache windows, each poll rebuilds the
// entire node set from fresh options data.
const ANALYTICS_MS = 20_000

/**
 * Canonical analytics envelope for the active symbol + timeframe. Every level,
 * node, wall and stat on every surface should ultimately derive from this so
 * numbers never disagree between components.
 *
 * The server recomputes the complete node set on every request and this hook
 * replaces the whole envelope on each poll (no merging), so nodes that no
 * longer meet criteria simply disappear — levels stay fresh and correct.
 */
export function useAnalytics(
  symbol: string,
  timeframe: Timeframe,
  autoUpdate = true,
) {
  const { data, error, isLoading, mutate } = useSWR<AnalyticsEnvelope>(
    symbol
      ? `/api/uw/analytics/${encodeURIComponent(symbol)}?tf=${timeframe}`
      : null,
    fetcher,
    {
      refreshInterval: autoUpdate ? ANALYTICS_MS : 0,
      keepPreviousData: true,
      // Refresh immediately when the user returns to the tab or reconnects so
      // they never stare at stale nodes.
      revalidateOnFocus: true,
      revalidateOnReconnect: true,
    },
  )
  return { envelope: data, error, isLoading, mutate }
}

export function useInstrument(symbol: string, autoUpdate = true) {
  const { data, error, isLoading, mutate } = useSWR<InstrumentData>(
    symbol ? `/api/uw/symbol/${encodeURIComponent(symbol)}` : null,
    fetcher,
    {
      refreshInterval: autoUpdate ? LIVE_MS : 0,
      keepPreviousData: true,
      revalidateOnFocus: false,
    },
  )
  return { instrument: data, error, isLoading, mutate }
}

export function useCandles(
  symbol: string,
  timeframe: Timeframe,
  autoUpdate = true,
) {
  const { data, error, isLoading } = useSWR<{ candles: Candle[] }>(
    symbol
      ? `/api/uw/candles/${encodeURIComponent(symbol)}?tf=${timeframe}`
      : null,
    fetcher,
    {
      refreshInterval: autoUpdate ? LIVE_MS : 0,
      keepPreviousData: true,
      revalidateOnFocus: false,
    },
  )
  return { candles: data?.candles, error, isLoading }
}

export function useQuotes(symbols: string[], autoUpdate = true) {
  const key = symbols.length
    ? `/api/uw/quotes?symbols=${symbols.join(",")}`
    : null
  const { data, error, isLoading } = useSWR<{ quotes: Ticker[] }>(key, fetcher, {
    refreshInterval: autoUpdate ? LIVE_MS : 0,
    keepPreviousData: true,
    revalidateOnFocus: false,
  })
  return { quotes: data?.quotes, error, isLoading }
}

export function useAlerts(symbol?: string, limit = 40) {
  const params = new URLSearchParams()
  if (symbol) params.set("symbol", symbol)
  params.set("limit", String(limit))
  const { data, error, isLoading, mutate } = useSWR<{ alerts: Signal[] }>(
    `/api/uw/alerts?${params.toString()}`,
    fetcher,
    {
      refreshInterval: 30_000,
      keepPreviousData: true,
      revalidateOnFocus: false,
    },
  )
  return { alerts: data?.alerts, error, isLoading, mutate }
}

export interface HealthResponse {
  keyConfigured: boolean
  demoMode: boolean
  overall: 'healthy' | 'degraded' | 'down' | 'demo' | 'unconfigured'
  passing: number
  total: number
  checks: { name: string; ok: boolean; status: number; ms: number }[]
  checkedAt: string
}

/** Global API health used to drive the top-bar provenance indicator. */
export function useHealth() {
  const { data, error, isLoading } = useSWR<HealthResponse>(
    '/api/uw/health',
    fetcher,
    {
      refreshInterval: 60_000,
      keepPreviousData: true,
      revalidateOnFocus: false,
    },
  )
  return { health: data, error, isLoading }
}

export function useGexBoard(symbol: string, autoUpdate = true) {
  const { data, error, isLoading } = useSWR<GexBoard>(
    symbol ? `/api/uw/gex-board?symbol=${encodeURIComponent(symbol)}` : null,
    fetcher,
    {
      refreshInterval: autoUpdate ? LIVE_MS : 0,
      keepPreviousData: true,
      revalidateOnFocus: false,
    },
  )
  return { board: data, error, isLoading }
}
