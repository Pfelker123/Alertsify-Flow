'use client'

import { useFilters } from '@/components/filters-context'
import { useInstrumentData } from '@/components/instrument-provider'
import { getKeyLevels, getTicker } from '@/lib/mock-data'
import { cn } from '@/lib/utils'
import type { KeyLevel } from '@/lib/types'

const DOT: Record<KeyLevel['label'], string> = {
  'Buy Above': 'bg-bull',
  Attraction: 'bg-attraction',
  Continuation: 'bg-bull',
  Reversal: 'bg-reversal',
  'Sell Below': 'bg-bear',
}

const VALUE_COLOR: Record<KeyLevel['label'], string> = {
  'Buy Above': 'text-bull',
  Attraction: 'text-attraction',
  Continuation: 'text-bull',
  Reversal: 'text-reversal',
  'Sell Below': 'text-bear',
}

// Display order matches the reference: Buy / Attraction / Continuation / Reversal / Sell
const ORDER: KeyLevel['label'][] = [
  'Buy Above',
  'Attraction',
  'Continuation',
  'Reversal',
  'Sell Below',
]

export function KeyLevels() {
  const { symbol, expiration } = useFilters()
  const { data } = useInstrumentData()
  const levels = data?.levels ?? getKeyLevels(symbol, expiration)
  const spot = data?.ticker.price ?? getTicker(symbol).price
  const sorted = ORDER.map(
    (label) =>
      levels.find((l) => l.label === label) ??
      getKeyLevels(symbol, expiration).find((l) => l.label === label)!,
  )

  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <div className="flex items-center justify-between">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Key Levels
        </h3>
        <span className="font-mono text-[10px] text-text-muted">
          spot {spot.toFixed(2)}
        </span>
      </div>
      <div className="mt-3 space-y-1">
        {sorted.map((l) => {
          const pct = ((l.price - spot) / spot) * 100
          return (
            <div
              key={l.id}
              className="flex items-center justify-between rounded-lg px-2 py-1.5 transition-colors hover:bg-accent"
            >
              <div className="flex items-center gap-2">
                <span className={cn('size-2.5 rounded-full', DOT[l.label])} />
                <span className="text-sm text-foreground">{l.label}</span>
              </div>
              <div className="flex items-center gap-3">
                <span
                  className={cn(
                    'font-mono text-sm font-semibold tabular-nums',
                    VALUE_COLOR[l.label],
                  )}
                >
                  {l.price.toFixed(2)}
                </span>
                <span
                  className={cn(
                    'w-14 text-right font-mono text-[11px] tabular-nums',
                    pct > 0.05
                      ? 'text-bull'
                      : pct < -0.05
                        ? 'text-bear'
                        : 'text-text-muted',
                  )}
                >
                  {pct >= 0 ? '+' : ''}
                  {pct.toFixed(1)}%
                </span>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
