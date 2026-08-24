'use client'

import { createContext, useContext, useState, type ReactNode } from 'react'
import { EXPIRY_OPTIONS } from '@/lib/mock-data'
import type { FocusSignal, NodeHorizon, Timeframe } from '@/lib/types'

interface FiltersState {
  symbol: string
  setSymbol: (s: string) => void
  expiration: string
  setExpiration: (e: string) => void
  timeframe: Timeframe
  setTimeframe: (t: Timeframe) => void
  nodeView: NodeHorizon | 'all'
  setNodeView: (v: NodeHorizon | 'all') => void
  simpleMode: boolean
  setSimpleMode: (b: boolean) => void
  nodesOn: boolean
  setNodesOn: (b: boolean) => void
  showAttraction: boolean
  setShowAttraction: (b: boolean) => void
  showReversal: boolean
  setShowReversal: (b: boolean) => void
  showContinuation: boolean
  setShowContinuation: (b: boolean) => void
  showSellZone: boolean
  setShowSellZone: (b: boolean) => void
  showTrails: boolean
  setShowTrails: (b: boolean) => void
  autoUpdate: boolean
  setAutoUpdate: (b: boolean) => void
  focusSignal: FocusSignal | null
  setFocusSignal: (s: FocusSignal | null) => void
}

const FiltersContext = createContext<FiltersState | null>(null)

export function FiltersProvider({ children }: { children: ReactNode }) {
  const [symbolState, setSymbolState] = useState('SPY')
  const [expiration, setExpiration] = useState(EXPIRY_OPTIONS[0])
  const [timeframe, setTimeframe] = useState<Timeframe>('5m')
  const [nodeView, setNodeView] = useState<NodeHorizon | 'all'>('all')
  const [simpleMode, setSimpleMode] = useState(false)
  const [nodesOn, setNodesOn] = useState(true)
  const [showAttraction, setShowAttraction] = useState(true)
  const [showReversal, setShowReversal] = useState(true)
  const [showContinuation, setShowContinuation] = useState(true)
  const [showSellZone, setShowSellZone] = useState(true)
  const [showTrails, setShowTrails] = useState(true)
  const [autoUpdate, setAutoUpdate] = useState(true)
  const [focusSignal, setFocusSignal] = useState<FocusSignal | null>(null)

  // Changing the symbol directly (tape, search) clears any pinned alert.
  function setSymbol(s: string) {
    setSymbolState(s)
    setFocusSignal(null)
  }

  return (
    <FiltersContext.Provider
      value={{
        symbol: symbolState,
        setSymbol,
        expiration,
        setExpiration,
        timeframe,
        setTimeframe,
        nodeView,
        setNodeView,
        simpleMode,
        setSimpleMode,
        nodesOn,
        setNodesOn,
        showAttraction,
        setShowAttraction,
        showReversal,
        setShowReversal,
        showContinuation,
        setShowContinuation,
        showSellZone,
        setShowSellZone,
        showTrails,
        setShowTrails,
        autoUpdate,
        setAutoUpdate,
        focusSignal,
        setFocusSignal,
      }}
    >
      {children}
    </FiltersContext.Provider>
  )
}

export function useFilters() {
  const ctx = useContext(FiltersContext)
  if (!ctx) throw new Error('useFilters must be used within FiltersProvider')
  return ctx
}
