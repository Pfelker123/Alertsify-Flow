'use client'

import { useEffect, useRef, useState } from 'react'
import { Star, Zap, Waves, CornerUpLeft, TrendingUp, ArrowLeftRight, ChevronRight, ChevronLeft } from 'lucide-react'
import { cn } from '@/lib/utils'
import { FLOW_UNIVERSE, HEATMAP_STRIKE_COUNTS, type HeatmapStrikeCount } from '@/lib/mock-data'
import { useGammaHeatmap } from '@/lib/uw/hooks'
import { DataSourceBadge } from '@/components/data-source-badge'
import type { GammaHeatmapRow } from '@/lib/types'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

// --- formatters -------------------------------------------------------------

function money(v: number | null): string {
  if (v === null || v === 0) return v === 0 ? '$0' : ''
  const sign = v < 0 ? '-' : ''
  const abs = Math.abs(v)
  if (abs >= 1e9) return `${sign}$${(abs / 1e9).toFixed(1)}B`
  if (abs >= 1e6) return `${sign}$${(abs / 1e6).toFixed(1)}M`
  if (abs >= 1e3) return `${sign}$${(abs / 1e3).toFixed(0)}K`
  return `${sign}$${abs.toFixed(0)}`
}

function fmtDate(iso: string) {
  const d = new Date(iso + 'T00:00:00Z')
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' })
}

// Standard monthly options expiration = the 3rd Friday of the month;
// quarterly OPEX is that same Friday in Mar/Jun/Sep/Dec.
function opexInfo(iso: string): { quarterly: boolean } | null {
  const d = new Date(iso + 'T00:00:00Z')
  const firstOfMonth = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1))
  const firstFridayOffset = (5 - firstOfMonth.getUTCDay() + 7) % 7
  const thirdFriday = 1 + firstFridayOffset + 14
  if (d.getUTCDate() !== thirdFriday) return null
  const quarterly = [2, 5, 8, 11].includes(d.getUTCMonth())
  return { quarterly }
}

// Voltick-style board: real cells get a bold, near-solid fill (bull green /
// bear red) with bright white text — a checkerboard of hot/cold blocks you
// can read from across the room, not a subtle per-cell gradient. Only true
// noise (sub-$1K, or a rounding-error sliver of the board's scale) recedes
// to dim ink on bare background. The biggest strikes get one step brighter
// plus a glow so they still stand out from the rest of the solid fill.
function cellVisual(v: number | null, max: number) {
  if (v === null || v === 0) {
    return { style: undefined, cls: 'text-muted-foreground/30 font-normal' }
  }
  const abs = Math.abs(v)
  // A fixed-ish floor, not a share of the board's max — otherwise a single
  // huge print at the pin strike would wash out every other genuinely large
  // number on the board just because it isn't THE biggest.
  const trivial = abs < Math.max(max * 0.004, 15_000)
  if (trivial) {
    return { style: undefined, cls: 'text-foreground/45 font-normal' }
  }
  const token = v > 0 ? '--bull' : '--bear'
  const huge = abs >= max * 0.55
  return {
    style: {
      backgroundColor: `color-mix(in oklch, var(${token}) ${huge ? 82 : 58}%, black)`,
      ...(huge ? { boxShadow: `0 0 14px -2px color-mix(in oklch, var(${token}) 75%, transparent)` } : {}),
    },
    cls: huge ? 'text-[12px] font-extrabold text-white' : 'text-[11.5px] font-bold text-white',
  }
}

export function GammaHeatmap() {
  const [symbol, setSymbol] = useState('SPY')
  const [strikeCount, setStrikeCount] = useState<HeatmapStrikeCount>(50)
  const [selected, setSelected] = useState<number | null>(null)

  const { board, isLoading } = useGammaHeatmap(symbol, strikeCount)

  // Center the board on the spot row whenever the symbol/strike-count changes,
  // so the very first thing visible is price with context above and below it.
  const scrollRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const el = scrollRef.current
    if (!el) return
    const priceEl = el.querySelector<HTMLElement>('[data-spot-row="true"]')
    if (priceEl) {
      el.scrollTop = Math.max(0, priceEl.offsetTop - el.clientHeight / 2 + priceEl.clientHeight / 2)
    }
  }, [board])

  if (!board) {
    return (
      <div className="flex h-64 items-center justify-center rounded-xl border border-border bg-card text-sm text-muted-foreground">
        {isLoading ? 'Loading gamma heat map…' : 'No gamma data available.'}
      </div>
    )
  }

  const { columns, rows, maxCellAbs, maxNetAbs, metrics, spot } = board
  const selectedRow = selected !== null ? rows.find((r) => r.strike === selected) ?? null : null

  return (
    <div className="flex flex-col gap-3">
      {/* Header controls */}
      <div className="flex flex-wrap items-center gap-2 rounded-xl border border-border bg-card p-2.5">
        <Select value={symbol} onValueChange={(v) => { setSymbol(v ?? 'SPY'); setSelected(null) }}>
          <SelectTrigger size="sm" className="h-7 w-24 font-mono text-[12px] font-semibold">
            <SelectValue placeholder="SPY" />
          </SelectTrigger>
          <SelectContent>
            {FLOW_UNIVERSE.map((t) => (
              <SelectItem key={t.symbol} value={t.symbol} className="font-mono text-[12px]">
                {t.symbol}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <span className="font-mono text-[12px] tabular-nums text-muted-foreground">${spot.toFixed(2)}</span>

        <div className="ml-2 flex items-center gap-2">
          <span className="text-[11px] text-text-muted">Strikes</span>
          <SegmentedControl value={strikeCount} onChange={setStrikeCount} options={HEATMAP_STRIKE_COUNTS.map((v) => ({ value: v, label: String(v) }))} />
        </div>

        <span
          className={cn(
            'rounded-full px-2 py-0.5 text-[11px] font-medium',
            metrics.regime === 'positive' ? 'bg-bull/15 text-bull' : 'bg-bear/15 text-bear',
          )}
        >
          {metrics.regime === 'positive' ? 'Positive Gamma' : 'Negative Gamma'}
        </span>

        <DataSourceBadge
          meta={{ source: board.live ? 'live' : 'demo', fetchedAt: new Date().toISOString() }}
          showAge={false}
        />

        <span className="ml-auto flex items-center gap-1 font-mono text-[11px] text-text-muted">
          Net GEX · {fmtDate(columns[0].date)}
          <ChevronRight className="size-3" />
        </span>
      </div>

      <div className={cn('grid gap-3', selectedRow ? 'xl:grid-cols-[minmax(0,1fr)_280px]' : 'grid-cols-1')}>
        {/* Board */}
        <div ref={scrollRef} className="thin-scroll max-h-[640px] overflow-auto rounded-xl border border-border bg-card">
          <table className="w-full min-w-[980px] border-collapse">
            <thead>
              <tr className="border-b border-border">
                <th className="sticky left-0 top-0 z-20 bg-card px-3 py-2 text-left text-[11px] font-medium text-muted-foreground">
                  Strike
                </th>
                {columns.map((c) => {
                  const opex = opexInfo(c.date)
                  return (
                    <th
                      key={c.date}
                      className={cn(
                        'px-2 py-1.5 text-center align-top',
                        c.isNearest && 'rounded-t-md ring-1 ring-inset ring-primary/60 bg-primary/10',
                      )}
                    >
                      <div className="flex flex-col items-center gap-0.5">
                        <span className={cn('font-mono text-[11.5px] tabular-nums', c.isNearest ? 'font-extrabold text-primary' : 'font-semibold text-foreground/80')}>
                          {c.label}
                        </span>
                        <HeaderStat icon={Star} cls="text-attraction" value={c.attraction} />
                        <HeaderStat icon={Zap} cls="text-spot" value={c.wall} />
                        <HeaderStat icon={Waves} cls="text-foreground/60" value={c.move} />
                        {opex && (
                          <span
                            className={cn(
                              'mt-0.5 rounded px-1 text-[8px] font-bold uppercase tracking-wide',
                              opex.quarterly ? 'bg-attraction/25 text-attraction' : 'bg-secondary text-muted-foreground',
                            )}
                          >
                            OPEX{opex.quarterly ? ' · Q' : ''}
                          </span>
                        )}
                        {c.isNearest && (
                          <span className="mt-0.5 rounded bg-primary/25 px-1 text-[8px] font-bold text-primary">
                            {board.updatedMinutesAgo}m ago
                          </span>
                        )}
                      </div>
                    </th>
                  )
                })}
                <th className="px-3 py-2 text-right text-[11px] font-medium text-muted-foreground">Net GEX</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <HeatRow
                  key={r.strike}
                  row={r}
                  columns={columns}
                  maxCellAbs={maxCellAbs}
                  maxNetAbs={maxNetAbs}
                  selected={selected === r.strike}
                  onSelect={() => setSelected((s) => (s === r.strike ? null : r.strike))}
                />
              ))}
            </tbody>
          </table>
        </div>

        {selectedRow && (
          <StrikeDetail row={selectedRow} columns={columns} spot={spot} onClose={() => setSelected(null)} />
        )}
      </div>

      {/* Legend */}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 rounded-xl border border-border bg-card px-3 py-2.5">
        <LegendItem cls="bg-bull" label="Positive gamma (support)" />
        <LegendItem cls="bg-bear" label="Negative gamma (fuel)" />
        <LegendItem cls="bg-spot" label="Spot" />
        <LegendItem cls="bg-attraction" label="Attraction" />
        <LegendItem cls="bg-reversal" label="Reversal risk" />
        <span className="ml-auto text-[10px] text-text-muted">1x / 1.5x / 2x = implied-move bands from spot</span>
      </div>

      {/* Bottom KPI cards, matching Flowster's existing GEX metrics. */}
      <StatsRow metrics={metrics} spot={spot} />
    </div>
  )
}

function HeaderStat({ icon: Icon, cls, value }: { icon: typeof Star; cls: string; value: number }) {
  return (
    <span className="flex items-center gap-0.5 font-mono text-[10.5px] font-semibold tabular-nums text-foreground">
      <Icon className={cn('size-2.5', cls)} strokeWidth={2.5} />
      {value.toFixed(value >= 1000 ? 0 : 1)}
    </span>
  )
}

function LegendItem({ cls, label }: { cls: string; label: string }) {
  return (
    <div className="flex items-center gap-1.5">
      <span className={cn('size-2.5 rounded-sm', cls)} />
      <span className="text-[11px] text-text-muted">{label}</span>
    </div>
  )
}

function HeatRow({
  row,
  columns,
  maxCellAbs,
  maxNetAbs,
  selected,
  onSelect,
}: {
  row: GammaHeatmapRow
  columns: { date: string; isNearest: boolean }[]
  maxCellAbs: number
  maxNetAbs: number
  selected: boolean
  onSelect: () => void
}) {
  const roleCls = row.isSpot
    ? 'bg-spot/25 text-spot'
    : row.isReversal
      ? 'bg-reversal/25 text-reversal'
      : row.isAttraction
        ? 'bg-attraction/25 text-attraction'
        : row.isFlip
          ? 'bg-spot/15 text-spot'
          : null
  return (
    <tr
      onClick={onSelect}
      data-spot-row={row.isSpot ? 'true' : undefined}
      className={cn(
        'cursor-pointer transition-colors last:border-0 hover:bg-accent/50',
        selected && 'ring-1 ring-inset ring-primary/50',
      )}
    >
      <td
        className={cn(
          'sticky left-0 z-10 border-b border-border/60 px-3 py-1 font-mono text-[12px] tabular-nums',
          selected ? 'bg-primary/15' : roleCls ? roleCls.split(' ')[0] : 'bg-card',
        )}
      >
        <div className="flex items-center gap-1.5">
          {row.moveBand && (
            <span
              className="rounded bg-secondary px-1 text-[8px] font-bold text-muted-foreground"
              title={`${row.moveBand} implied move from spot`}
            >
              {row.moveBand}
            </span>
          )}
          {row.isSpot && <ChevronLeft className="size-3.5 text-spot" strokeWidth={3} />}
          {row.isFlip && !row.isSpot && <Zap className="size-3.5 text-spot" strokeWidth={2.5} fill="currentColor" />}
          {row.isReversal && <CornerUpLeft className="size-3.5 text-reversal" strokeWidth={2.5} />}
          {row.isAttraction && <Star className="size-3.5 text-attraction" strokeWidth={2} fill="currentColor" />}
          <span
            className={cn(
              'text-[13px] font-bold',
              row.isSpot
                ? 'text-spot'
                : row.isReversal
                  ? 'text-reversal'
                  : row.isAttraction
                    ? 'text-attraction'
                    : row.isFlip
                      ? 'text-spot'
                      : 'text-foreground/70 text-[12px] font-semibold',
            )}
          >
            {row.strike}
          </span>
          {(row.isAttraction || row.isReversal) && (
            <span
              className={cn(
                'rounded-full px-1.5 py-px text-[9px] font-bold',
                row.isAttraction ? 'bg-attraction/20 text-attraction' : 'bg-reversal/20 text-reversal',
              )}
            >
              {row.netPct}%
            </span>
          )}
          {row.isSpot && <span className="text-[9px] font-extrabold uppercase tracking-wide text-spot">Spot</span>}
          {row.isFlip && !row.isSpot && <span className="text-[9px] font-extrabold uppercase tracking-wide text-spot">Flip</span>}
        </div>
      </td>
      {row.values.map((v, i) => {
        const cell = cellVisual(v, maxCellAbs)
        return (
          <td key={columns[i].date} className="border-b border-border/60 px-1 py-1 text-center" style={cell.style}>
            <span className={cn('font-mono tabular-nums', cell.cls)}>{v === null ? '·' : money(v)}</span>
          </td>
        )
      })}
      <td className="border-b border-border/60 px-3 py-1">
        <div className="flex items-center justify-end gap-2">
          <span
            className={cn(
              'rounded px-1 font-mono text-[10px] font-bold tabular-nums',
              row.trendUp ? 'bg-bull/15 text-bull' : 'bg-bear/15 text-bear',
            )}
          >
            {row.trendUp ? '▲' : '▼'}
            {row.trendPct}%
          </span>
          <div className="relative h-3.5 w-16">
            <div className="absolute left-1/2 top-0 h-full w-px bg-border" />
            <div
              className={cn('absolute top-0 h-full rounded-sm', row.net >= 0 ? 'bg-bull' : 'bg-bear')}
              style={{
                left: row.net >= 0 ? '50%' : undefined,
                right: row.net < 0 ? '50%' : undefined,
                width: `${(Math.abs(row.net) / maxNetAbs) * 48}%`,
                boxShadow:
                  Math.abs(row.net) / maxNetAbs > 0.5
                    ? `0 0 8px color-mix(in oklch, var(${row.net >= 0 ? '--bull' : '--bear'}) 70%, transparent)`
                    : undefined,
              }}
            />
          </div>
          <span className="w-16 text-right font-mono text-[11.5px] font-bold tabular-nums text-foreground">{money(row.net)}</span>
          {row.isSpot ? (
            <span className="shrink-0 rounded bg-spot/20 px-1.5 py-0.5 text-[9px] font-extrabold uppercase tracking-wide text-spot">
              Spot
            </span>
          ) : (
            <span className={cn('size-2 shrink-0 rounded-full', row.net >= 0 ? 'bg-bull' : 'bg-bear')} />
          )}
        </div>
      </td>
    </tr>
  )
}

function StrikeDetail({
  row,
  columns,
  spot,
  onClose,
}: {
  row: GammaHeatmapRow
  columns: { label: string; date: string }[]
  spot: number
  onClose: () => void
}) {
  const dist = ((row.strike - spot) / spot) * 100
  const positive = row.net >= 0
  const colMax = Math.max(1, ...row.values.map((v) => Math.abs(v ?? 0)))
  return (
    <aside className="flex w-full flex-col gap-3 rounded-xl border border-border bg-card p-4">
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-2">
            <span className={cn('size-2 rounded-full', positive ? 'bg-bull' : 'bg-bear')} />
            <span className="font-mono text-xl font-semibold tabular-nums text-foreground">{row.strike}</span>
          </div>
          <span className="text-[11px] text-text-muted">
            {dist >= 0 ? '+' : ''}
            {dist.toFixed(2)}% vs price
          </span>
        </div>
        <button onClick={onClose} className="rounded-md px-2 py-0.5 text-[11px] text-text-muted hover:bg-accent hover:text-foreground">
          Close
        </button>
      </div>

      {(row.isSpot || row.isFlip || row.isReversal || row.isAttraction) && (
        <div className="flex flex-wrap gap-1.5">
          {row.isSpot && <Tag icon={Zap} cls="bg-spot/15 text-spot" label="Spot" />}
          {row.isFlip && <Tag icon={Zap} cls="bg-spot/15 text-spot" label="Gamma Flip" />}
          {row.isReversal && <Tag icon={CornerUpLeft} cls="bg-reversal/15 text-reversal" label="Reversal risk" />}
          {row.isAttraction && <Tag icon={Star} cls="bg-attraction/15 text-attraction" label="Attraction" />}
        </div>
      )}

      <div className="rounded-lg bg-secondary/50 px-3 py-2">
        <div className="text-[10px] uppercase tracking-wider text-text-muted">Aggregate net GEX</div>
        <div className={cn('font-mono text-lg font-semibold tabular-nums', positive ? 'text-bull' : 'text-bear')}>{money(row.net)}</div>
      </div>

      <div>
        <div className="mb-1.5 text-[10px] font-medium uppercase tracking-wider text-text-muted">By expiry</div>
        <div className="flex flex-col gap-1.5">
          {columns.map((c, i) => {
            const v = row.values[i]
            const pct = v === null ? 0 : Math.min(100, (Math.abs(v) / colMax) * 100)
            const pos = (v ?? 0) >= 0
            return (
              <div key={c.date} className="flex items-center gap-2">
                <span className="w-10 shrink-0 font-mono text-[10px] tabular-nums text-muted-foreground">{c.label}</span>
                <div className="relative h-2 flex-1 rounded-full bg-muted/40">
                  <div
                    className={cn('absolute inset-y-0 left-0 rounded-full', v === null ? 'bg-transparent' : pos ? 'bg-bull/70' : 'bg-bear/70')}
                    style={{ width: `${pct}%` }}
                  />
                </div>
                <span className="w-14 shrink-0 text-right font-mono text-[10px] tabular-nums text-muted-foreground">{v === null ? '—' : money(v)}</span>
              </div>
            )
          })}
        </div>
      </div>
    </aside>
  )
}

function Tag({ icon: Icon, cls, label }: { icon: typeof Star; cls: string; label: string }) {
  return (
    <span className={cn('flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold', cls)}>
      <Icon className="size-3" />
      {label}
    </span>
  )
}

function StatsRow({ metrics, spot }: { metrics: import('@/lib/types').GexBoardMetrics; spot: number }) {
  const rel = (strike: number) => {
    const d = ((strike - spot) / spot) * 100
    return `${d >= 0 ? '+' : ''}${d.toFixed(1)}% vs price`
  }
  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-8">
      <StatCard label="Net GEX" value={money(metrics.netGex) || '$0'} sub={metrics.regime === 'positive' ? 'Calm market' : 'Volatile market'} accent={metrics.regime === 'positive' ? 'bull' : 'bear'} icon={ArrowLeftRight} />
      <StatCard label="Put Wall" value={String(metrics.putWall)} sub={rel(metrics.putWall)} accent="bear" icon={CornerUpLeft} />
      <StatCard label="Attraction" value={String(metrics.callWall)} sub={rel(metrics.callWall)} accent="attraction" icon={Star} />
      <StatCard label="0DTE Attraction" value={String(metrics.zeroDte)} sub={rel(metrics.zeroDte)} accent="attraction" icon={Star} />
      <StatCard label="Gamma Flip" value={String(metrics.gammaFlip)} sub={rel(metrics.gammaFlip)} accent="spot" icon={Zap} />
      <StatCard label="Grower" value={String(metrics.grower.strike)} sub={`+${metrics.grower.share}% of gamma`} accent="bull" icon={TrendingUp} />
      <StatCard label="Implied Move" value={`±${metrics.move}`} sub="today" icon={Waves} />
      <StatCard label="ATM IV" value={`${metrics.atmIv}%`} />
    </div>
  )
}

function StatCard({
  label,
  value,
  sub,
  accent,
  icon: Icon,
}: {
  label: string
  value: string
  sub?: string
  accent?: 'bull' | 'bear' | 'spot' | 'attraction'
  icon?: typeof Star
}) {
  const iconCls =
    accent === 'bull' ? 'text-bull' : accent === 'bear' ? 'text-bear' : accent === 'spot' ? 'text-spot' : accent === 'attraction' ? 'text-attraction' : ''
  const barCls = accent === 'bull' ? 'bg-bull' : accent === 'bear' ? 'bg-bear' : accent === 'spot' ? 'bg-spot' : accent === 'attraction' ? 'bg-attraction' : 'bg-border'
  return (
    <div className="group relative flex flex-col gap-1 overflow-hidden rounded-lg border border-border bg-card px-3 py-2.5 transition-transform hover:-translate-y-0.5">
      <span className={cn('absolute inset-x-0 top-0 h-1', barCls)} />
      <span className="mt-1 flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
        {Icon && (
          <span className={cn('flex size-4 items-center justify-center rounded-full', accent ? `${barCls}/15` : 'bg-secondary')}>
            <Icon className={cn('size-2.5', iconCls)} strokeWidth={2.5} />
          </span>
        )}
        {label}
      </span>
      <span
        className={cn(
          'font-mono text-xl font-extrabold tabular-nums leading-none',
          accent === 'bull' && 'text-bull',
          accent === 'bear' && 'text-bear',
          accent === 'spot' && 'text-spot',
          accent === 'attraction' && 'text-attraction',
          !accent && 'text-foreground',
        )}
      >
        {value}
      </span>
      {sub ? <span className="text-[11px] text-muted-foreground">{sub}</span> : null}
    </div>
  )
}

function SegmentedControl<T extends number>({
  value,
  onChange,
  options,
}: {
  value: T
  onChange: (v: T) => void
  options: { value: T; label: string }[]
}) {
  return (
    <div role="group" className="flex items-center gap-0.5 rounded-md border border-border/60 bg-secondary/40 p-0.5">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          aria-pressed={value === o.value}
          onClick={() => onChange(o.value)}
          className={cn(
            'rounded px-2 py-1 text-[11px] font-bold whitespace-nowrap transition-colors',
            value === o.value ? 'bg-primary/15 text-primary ring-1 ring-inset ring-primary/60' : 'text-text-muted hover:text-foreground',
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  )
}
