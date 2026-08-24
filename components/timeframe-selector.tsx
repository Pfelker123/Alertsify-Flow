'use client'

import { useFilters } from '@/components/filters-context'
import type { Timeframe } from '@/lib/types'
import { cn } from '@/lib/utils'

const TIMEFRAMES: Timeframe[] = [
  '1m',
  '3m',
  '5m',
  '10m',
  '15m',
  '30m',
  '1h',
  'daily',
  'weekly',
]

const LABELS: Record<Timeframe, string> = {
  '1m': '1m',
  '3m': '3m',
  '5m': '5m',
  '10m': '10m',
  '15m': '15m',
  '30m': '30m',
  '1h': '1h',
  daily: 'D',
  weekly: 'W',
}

export function TimeframeSelector() {
  const { timeframe, setTimeframe } = useFilters()
  return (
    <div className="inline-flex flex-wrap items-center gap-1 rounded-lg border border-border bg-card p-1">
      {TIMEFRAMES.map((tf) => (
        <button
          key={tf}
          onClick={() => setTimeframe(tf)}
          className={cn(
            'rounded-md px-2.5 py-1 text-xs font-medium transition-colors',
            timeframe === tf
              ? 'bg-primary text-primary-foreground'
              : 'text-muted-foreground hover:bg-accent hover:text-foreground',
          )}
        >
          {LABELS[tf]}
        </button>
      ))}
    </div>
  )
}
