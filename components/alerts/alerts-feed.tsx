'use client'

import { useState } from 'react'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { SignalItem } from '@/components/signal-item'
import { useAlerts } from '@/lib/uw/hooks'
import { ALL_ALERTS } from '@/lib/mock-data'
import type { SignalType } from '@/lib/types'

const FILTERS: { value: SignalType | 'all'; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'buy', label: 'Buy' },
  { value: 'sell', label: 'Sell' },
  { value: 'reversal', label: 'Reversal' },
  { value: 'continuation', label: 'Continuation' },
]

export function AlertsFeed() {
  const [filter, setFilter] = useState<SignalType | 'all'>('all')
  const { alerts: live, isLoading } = useAlerts(undefined, 60)
  const source = live && live.length ? live : ALL_ALERTS
  const alerts =
    filter === 'all' ? source : source.filter((a) => a.type === filter)

  return (
    <div className="space-y-4">
      <Tabs value={filter} onValueChange={(v) => setFilter(v as SignalType | 'all')}>
        <TabsList>
          {FILTERS.map((f) => (
            <TabsTrigger key={f.value} value={f.value}>
              {f.label}
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>

      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        {alerts.map((a) => (
          <SignalItem key={a.id} signal={a} />
        ))}
      </div>
      {alerts.length === 0 && (
        <p className="rounded-xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
          {isLoading ? 'Loading live alerts…' : 'No alerts of this type right now.'}
        </p>
      )}
    </div>
  )
}
