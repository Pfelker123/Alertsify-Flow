'use client'

import { createContext, useContext, type ReactNode } from 'react'
import { useFilters } from '@/components/filters-context'
import { useInstrument, useCandles, useAnalytics } from '@/lib/uw/hooks'
import type { AnalyticsEnvelope } from '@/lib/uw/hooks'
import type { InstrumentData } from '@/lib/uw/service'
import type { FlowstersAnalytics } from '@/lib/analytics/types'
import type { DataMeta } from '@/lib/market/types'
import type { Candle } from '@/lib/types'

interface InstrumentContextValue {
  /** Legacy per-card instrument payload (being migrated to `analytics`). */
  data: InstrumentData | undefined
  candles: Candle[] | undefined
  isLoading: boolean
  live: boolean
  /** Canonical analytics envelope: the single source of truth. */
  envelope: AnalyticsEnvelope | undefined
  analytics: FlowstersAnalytics | undefined
  meta: DataMeta | undefined
}

const InstrumentContext = createContext<InstrumentContextValue | null>(null)

// Fetches all live data for the active symbol once and shares it with every
// dashboard card. Candles are fetched separately because they depend on the
// selected timeframe. The canonical analytics envelope is fetched here too so
// every surface reads identical levels, nodes and walls from one source.
export function InstrumentProvider({ children }: { children: ReactNode }) {
  const { symbol, timeframe, autoUpdate } = useFilters()
  const { instrument, isLoading } = useInstrument(symbol, autoUpdate)
  const { candles } = useCandles(symbol, timeframe, autoUpdate)
  const { envelope } = useAnalytics(symbol, timeframe, autoUpdate)

  return (
    <InstrumentContext.Provider
      value={{
        data: instrument,
        candles,
        isLoading,
        live: envelope?.meta.source === 'live',
        envelope,
        analytics: envelope?.data?.analytics,
        meta: envelope?.meta,
      }}
    >
      {children}
    </InstrumentContext.Provider>
  )
}

// Returns live instrument data when rendered inside an InstrumentProvider.
const EMPTY: InstrumentContextValue = {
  data: undefined,
  candles: undefined,
  isLoading: false,
  live: false,
  envelope: undefined,
  analytics: undefined,
  meta: undefined,
}

export function useInstrumentData() {
  return useContext(InstrumentContext) ?? EMPTY
}

/** Convenience accessor for just the canonical analytics + provenance meta. */
export function useAnalyticsData() {
  const { analytics, meta, envelope, isLoading } = useInstrumentData()
  return { analytics, meta, envelope, isLoading }
}
