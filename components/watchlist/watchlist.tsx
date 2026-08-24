'use client'

import { Star } from 'lucide-react'
import { useFilters } from '@/components/filters-context'
import { useQuotes } from '@/lib/uw/hooks'
import { Sparkline } from '@/components/sparkline'
import { BiasBadge } from '@/components/bias-badge'
import { TICKERS, TICKER_SYMBOLS } from '@/lib/mock-data'
import { cn } from '@/lib/utils'

export function Watchlist() {
  const { setSymbol, symbol, autoUpdate } = useFilters()
  const { quotes, isLoading } = useQuotes(TICKER_SYMBOLS, autoUpdate)
  const quoteMap = new Map((quotes ?? []).map((q) => [q.symbol, q]))
  const rows = TICKERS.map((t) => quoteMap.get(t.symbol) ?? t)

  return (
    <div className="flex flex-col gap-6 p-4 sm:p-6">
      <header className="flex items-center gap-3">
        <div className="flex size-10 items-center justify-center rounded-xl bg-primary/15 text-primary">
          <Star className="size-5" />
        </div>
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Watchlist</h1>
          <p className="text-sm text-muted-foreground">
            Live price, bias, and momentum for your tracked tickers.
            {isLoading ? ' Loading…' : ''}
          </p>
        </div>
      </header>

      <div className="overflow-hidden rounded-xl border border-border">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-card/60 text-left text-xs uppercase tracking-wider text-muted-foreground">
              <th className="px-4 py-3 font-medium">Symbol</th>
              <th className="px-4 py-3 font-medium">Bias</th>
              <th className="px-4 py-3 text-right font-medium">Price</th>
              <th className="px-4 py-3 text-right font-medium">Change</th>
              <th className="hidden px-4 py-3 text-right font-medium sm:table-cell">
                Trend
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((t) => {
              const up = t.changePercent >= 0
              const active = t.symbol === symbol
              return (
                <tr
                  key={t.symbol}
                  onClick={() => setSymbol(t.symbol)}
                  className={cn(
                    'cursor-pointer border-b border-border/60 transition-colors last:border-0 hover:bg-accent/40',
                    active && 'bg-primary/5',
                  )}
                >
                  <td className="px-4 py-3">
                    <div className="font-semibold">{t.symbol}</div>
                    <div className="truncate text-xs text-muted-foreground">
                      {t.name}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <BiasBadge bias={t.bias} />
                  </td>
                  <td className="px-4 py-3 text-right font-mono font-semibold tabular-nums">
                    ${t.price.toFixed(2)}
                  </td>
                  <td
                    className={cn(
                      'px-4 py-3 text-right font-mono tabular-nums',
                      up ? 'text-bull' : 'text-bear',
                    )}
                  >
                    {up ? '+' : ''}
                    {t.change.toFixed(2)} ({up ? '+' : ''}
                    {t.changePercent.toFixed(2)}%)
                  </td>
                  <td className="hidden px-4 py-3 sm:table-cell">
                    <div className="flex justify-end">
                      <Sparkline
                        data={t.spark}
                        positive={up}
                        className="h-8 w-24"
                      />
                    </div>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
