'use client'

import { useMemo, useState } from 'react'
import { Radar } from 'lucide-react'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { SignalItem } from '@/components/signal-item'
import { useAlerts } from '@/lib/uw/hooks'
import { ALL_ALERTS } from '@/lib/mock-data'
import type { SignalType } from '@/lib/types'

const FILTERS: { value: SignalType | 'all'; label: string }[] = [
  { value: 'all', label: 'All Signals' },
  { value: 'buy', label: 'Buy Zones' },
  { value: 'sell', label: 'Sell Zones' },
  { value: 'reversal', label: 'Reversal Risk' },
  { value: 'continuation', label: 'Continuation' },
]

export function MarketScanner() {
  const [filter, setFilter] = useState<SignalType | 'all'>('all')
  const { alerts: live, isLoading } = useAlerts(undefined, 150)
  const source = live && live.length ? live : ALL_ALERTS

  const results = useMemo(() => {
    const list =
      filter === 'all' ? source : source.filter((a) => a.type === filter)
    return list
  }, [source, filter])

  const counts = useMemo(() => {
    const by = (t: SignalType) => source.filter((a) => a.type === t).length
    return {
      total: source.length,
      symbols: new Set(source.map((a) => a.symbol)).size,
      buy: by('buy'),
      sell: by('sell'),
    }
  }, [source])

  return (
    <div className="flex flex-col gap-6 p-4 sm:p-6">
      <header className="flex flex-col gap-4">
        <div className="flex items-center gap-3">
          <div className="flex size-10 items-center justify-center rounded-xl bg-primary/15 text-primary">
            <Radar className="size-5" />
          </div>
          <div>
            <h1 className="text-xl font-semibold tracking-tight">Scanner</h1>
            <p className="text-sm text-muted-foreground">
              Live options-flow signals across the whole market, ranked by
              premium and recency.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <StatCard label="Active signals" value={counts.total} />
          <StatCard label="Tickers moving" value={counts.symbols} />
          <StatCard label="Buy zones" value={counts.buy} tone="bull" />
          <StatCard label="Sell zones" value={counts.sell} tone="bear" />
        </div>
      </header>

      <Tabs value={filter} onValueChange={(v) => setFilter(v as SignalType | 'all')}>
        <TabsList>
          {FILTERS.map((f) => (
            <TabsTrigger key={f.value} value={f.value}>
              {f.label}
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>

      <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
        {results.map((a) => (
          <SignalItem key={a.id} signal={a} />
        ))}
      </div>

      {results.length === 0 && (
        <p className="rounded-xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
          {isLoading ? 'Scanning the market…' : 'No signals match this filter.'}
        </p>
      )}
    </div>
  )
}

function StatCard({
  label,
  value,
  tone,
}: {
  label: string
  value: number
  tone?: 'bull' | 'bear'
}) {
  const toneCls =
    tone === 'bull' ? 'text-bull' : tone === 'bear' ? 'text-bear' : 'text-foreground'
  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <p className={`font-mono text-2xl font-semibold tabular-nums ${toneCls}`}>
        {value}
      </p>
      <p className="mt-0.5 text-xs text-muted-foreground">{label}</p>
    </div>
  )
}
