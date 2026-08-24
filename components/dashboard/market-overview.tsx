'use client'

import { useFilters } from '@/components/filters-context'
import { useQuotes } from '@/lib/uw/hooks'
import { Sparkline } from '@/components/sparkline'
import { BiasBadge } from '@/components/bias-badge'
import { TICKERS, TICKER_SYMBOLS } from '@/lib/mock-data'
import { cn } from '@/lib/utils'

export function MarketOverview() {
  const { setSymbol, symbol, autoUpdate } = useFilters()
  const { quotes } = useQuotes(TICKER_SYMBOLS, autoUpdate)
  const quoteMap = new Map((quotes ?? []).map((q) => [q.symbol, q]))
  const tickers = TICKERS.map((t) => quoteMap.get(t.symbol) ?? t)

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-4">
      {tickers.map((t) => {
        const up = t.changePercent >= 0
        const active = t.symbol === symbol
        return (
          <button
            key={t.symbol}
            onClick={() => setSymbol(t.symbol)}
            className={cn(
              'group rounded-xl border bg-card p-4 text-left transition-colors hover:border-primary/50',
              active ? 'border-primary/60 ring-1 ring-primary/30' : 'border-border',
            )}
          >
            <div className="flex items-start justify-between">
              <div className="min-w-0">
                <p className="font-semibold tracking-tight">{t.symbol}</p>
                <p className="truncate text-xs text-muted-foreground">
                  {t.name}
                </p>
              </div>
              <BiasBadge bias={t.bias} />
            </div>

            <div className="mt-3 flex items-end justify-between gap-2">
              <div>
                <p className="font-mono text-lg font-semibold tabular-nums">
                  ${t.price.toFixed(2)}
                </p>
                <p
                  className={cn(
                    'font-mono text-xs font-medium tabular-nums',
                    up ? 'text-bull' : 'text-bear',
                  )}
                >
                  {up ? '+' : ''}
                  {t.change.toFixed(2)} ({up ? '+' : ''}
                  {t.changePercent.toFixed(2)}%)
                </p>
              </div>
              <Sparkline
                data={t.spark}
                positive={up}
                className="h-8 w-20 shrink-0"
              />
            </div>
          </button>
        )
      })}
    </div>
  )
}
