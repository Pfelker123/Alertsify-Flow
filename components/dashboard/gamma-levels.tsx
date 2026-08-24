'use client'

import { useFilters } from '@/components/filters-context'
import { useGexBoard } from '@/lib/uw/hooks'
import { cn } from '@/lib/utils'

// Compact dollar formatter: 56_700_000 -> "+56.7M"
function fmtGamma(v: number) {
  const sign = v > 0 ? '+' : v < 0 ? '-' : ''
  const abs = Math.abs(v)
  if (abs >= 1e9) return `${sign}${(abs / 1e9).toFixed(1)}B`
  if (abs >= 1e6) return `${sign}${(abs / 1e6).toFixed(1)}M`
  if (abs >= 1e3) return `${sign}${(abs / 1e3).toFixed(0)}K`
  return `${sign}${abs.toFixed(0)}`
}

const LEGEND = [
  { label: 'sticky', cls: 'bg-bull' },
  { label: 'slippery', cls: 'bg-bear' },
  { label: 'Attraction', cls: 'bg-attraction' },
]

export function GammaLevels() {
  const { symbol, autoUpdate } = useFilters()
  const { board, isLoading } = useGexBoard(symbol, autoUpdate)

  if (!board || isLoading) {
    return (
      <div className="rounded-xl border border-border bg-card p-4">
        <PanelHeader />
        <div className="mt-4 space-y-2">
          {Array.from({ length: 9 }).map((_, i) => (
            <div
              key={i}
              className="h-6 animate-pulse rounded bg-muted/40"
              style={{ animationDelay: `${i * 60}ms` }}
            />
          ))}
        </div>
      </div>
    )
  }

  // Show strikes closest to spot, ordered high -> low like the reference.
  const rows = [...board.rows]
    .sort((a, b) => Math.abs(a.strike - board.spot) - Math.abs(b.strike - board.spot))
    .slice(0, 11)
    .sort((a, b) => b.strike - a.strike)

  const max = board.maxNetAbs || 1
  // Index of the first row whose strike is at/below spot — the "price now" line.
  const priceNowIdx = rows.findIndex((r) => r.strike <= board.spot)

  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <PanelHeader />

      <div className="mt-3 flex items-center justify-between text-[10px] font-medium uppercase tracking-wider text-text-muted">
        <span>Price</span>
        <span>Net gamma</span>
      </div>

      <div className="mt-1.5">
        {rows.map((r, i) => {
          const pct = Math.min(100, (Math.abs(r.net) / max) * 100)
          const positive = r.net >= 0
          return (
            <div key={r.strike}>
              {i === priceNowIdx && (
                <div className="my-1 flex items-center gap-2">
                  <span className="font-mono text-[11px] font-semibold tabular-nums text-primary">
                    {board.spot.toFixed(2)}
                  </span>
                  <span className="h-px flex-1 bg-primary/60" />
                  <span className="text-[10px] font-medium text-primary">
                    price now
                  </span>
                </div>
              )}
              <div className="group flex items-center gap-2 py-0.5">
                <span
                  className={cn(
                    'size-1.5 shrink-0 rounded-full',
                    positive ? 'bg-bull' : 'bg-bear',
                  )}
                />
                <span
                  className={cn(
                    'w-12 shrink-0 font-mono text-[11px] tabular-nums',
                    r.isSpot ? 'font-semibold text-foreground' : 'text-muted-foreground',
                  )}
                >
                  {r.strike.toFixed(0)}
                </span>
                {/* diverging bar centered on a baseline */}
                <div className="relative flex h-3 flex-1 items-center">
                  <div className="absolute left-1/2 h-full w-px bg-border" />
                  <div
                    className={cn(
                      'absolute h-2 rounded-sm',
                      positive ? 'bg-bull/70' : 'bg-bear/70',
                    )}
                    style={{
                      left: positive ? '50%' : undefined,
                      right: positive ? undefined : '50%',
                      width: `${pct / 2}%`,
                    }}
                  />
                </div>
                <span
                  className={cn(
                    'w-14 shrink-0 text-right font-mono text-[11px] font-medium tabular-nums',
                    positive ? 'text-bull' : 'text-bear',
                  )}
                >
                  {fmtGamma(r.net)}
                </span>
              </div>
            </div>
          )
        })}
      </div>

      <div className="mt-3 flex items-center gap-3 border-t border-border pt-2.5">
        {LEGEND.map((l) => (
          <div key={l.label} className="flex items-center gap-1.5">
            <span className={cn('size-2 rounded-full', l.cls)} />
            <span className="text-[10px] text-text-muted">{l.label}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

function PanelHeader() {
  return (
    <div className="flex items-center justify-between">
      <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        Gamma Levels
      </h3>
      <span className="text-[10px] text-text-muted">Net GEX by strike</span>
    </div>
  )
}
