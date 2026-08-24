'use client'

import { useEffect, useRef, useState } from 'react'
import { Star, Zap, Waves, CornerUpLeft, Activity, TrendingUp, ArrowLeftRight, ChevronRight } from 'lucide-react'
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

// Cell background scaled by magnitude, bull for positive / bear for negative — the
// same green/red gamma-exposure language used everywhere else in Flowster.
function cellStyle(v: number | null, max: number) {
  if (v === null || v === 0) return undefined
  const a = Math.min(1, Math.abs(v) / max)
  const token = v > 0 ? '--bull' : '--bear'
  return {
    backgroundColor: `color-mix(in oklch, var(${token}) ${Math.round(a * 68 + 8)}%, transparent)`,
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
                {columns.map((c) => (
                  <th key={c.date} className={cn('px-2 py-1.5 text-center align-top', c.isNearest && 'bg-primary/5')}>
                    <div className="flex flex-col items-center gap-0.5">
                      <span className={cn('font-mono text-[11px] tabular-nums', c.isNearest ? 'font-semibold text-primary' : 'text-muted-foreground')}>
                        {c.label}
                      </span>
                      <HeaderStat icon={Star} cls="text-attraction" value={c.attraction} />
                      <HeaderStat icon={Zap} cls="text-foreground/70" value={c.wall} />
                      <HeaderStat icon={Waves} cls="text-spot" value={c.move} />
                      {c.isNearest && (
                        <span className="mt-0.5 rounded bg-primary/15 px-1 text-[8px] font-semibold text-primary">
                          {board.updatedMinutesAgo}m ago
                        </span>
                      )}
                    </div>
                  </th>
                ))}
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
    <span className="flex items-center gap-0.5 font-mono text-[10px] tabular-nums text-foreground/85">
      <Icon className={cn('size-2.5', cls)} />
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
  const special = row.isSpot || row.isFlip || row.isReversal || row.isAttraction
  return (
    <tr
      onClick={onSelect}
      data-spot-row={row.isSpot ? 'true' : undefined}
      className={cn(
        'cursor-pointer border-b border-border/40 transition-colors last:border-0 hover:bg-accent/50',
        row.isSpot && 'bg-spot/10',
        row.isReversal && !row.isSpot && 'bg-reversal/10',
        row.isAttraction && !row.isSpot && !row.isReversal && 'bg-attraction/10',
        row.isFlip && 'border-y border-dashed border-spot/40',
        selected && 'ring-1 ring-inset ring-primary/50',
      )}
    >
      <td
        className={cn(
          'sticky left-0 z-10 px-3 py-1 font-mono text-[12px] tabular-nums',
          selected ? 'bg-primary/10' : row.isSpot ? 'bg-spot/10' : row.isReversal ? 'bg-reversal/10' : row.isAttraction ? 'bg-attraction/10' : 'bg-card',
        )}
      >
        <div className="flex items-center gap-1.5">
          {row.moveBand && (
            <span className="rounded bg-secondary px-1 text-[8px] font-semibold text-muted-foreground" title={`${row.moveBand} implied move from spot`}>
              {row.moveBand}
            </span>
          )}
          {row.isSpot && <Zap className="size-3 text-spot" />}
          {row.isFlip && !row.isSpot && <Activity className="size-3 text-spot" />}
          {row.isReversal && <CornerUpLeft className="size-3 text-reversal" />}
          {row.isAttraction && <Star className="size-3 text-attraction" />}
          <span
            className={cn(
              'font-semibold',
              row.isSpot ? 'text-spot' : row.isReversal ? 'text-reversal' : row.isAttraction ? 'text-attraction' : special ? 'text-foreground' : 'text-muted-foreground',
            )}
          >
            {row.strike}
          </span>
          {row.isSpot && <span className="text-[9px] font-semibold uppercase tracking-wide text-spot">Spot</span>}
          {row.isFlip && !row.isSpot && <span className="text-[9px] font-semibold uppercase tracking-wide text-spot">Flip</span>}
        </div>
      </td>
      {row.values.map((v, i) => (
        <td key={columns[i].date} className="px-1 py-1 text-center" style={cellStyle(v, maxCellAbs)}>
          <span className={cn('font-mono text-[11px] tabular-nums', v === null || v === 0 ? 'text-muted-foreground/40' : 'text-foreground')}>
            {v === null ? '·' : money(v)}
          </span>
        </td>
      ))}
      <td className="px-3 py-1">
        <div className="flex items-center justify-end gap-2">
          <span className={cn('font-mono text-[10px] font-medium tabular-nums', row.trendUp ? 'text-bull' : 'text-bear')}>
            {row.trendUp ? '▲' : '▼'}
            {row.trendPct}%
          </span>
          <div className="relative h-3 w-16">
            <div className="absolute left-1/2 top-0 h-full w-px bg-border" />
            <div
              className={cn('absolute top-0 h-full rounded-sm', row.net >= 0 ? 'bg-bull' : 'bg-bear')}
              style={{
                left: row.net >= 0 ? '50%' : undefined,
                right: row.net < 0 ? '50%' : undefined,
                width: `${(Math.abs(row.net) / maxNetAbs) * 48}%`,
              }}
            />
          </div>
          <span className="w-16 text-right font-mono text-[11px] tabular-nums text-muted-foreground">{money(row.net)}</span>
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
          {row.isFlip && <Tag icon={Activity} cls="bg-spot/15 text-spot" label="Gamma Flip" />}
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
      <StatCard label="Gamma Flip" value={String(metrics.gammaFlip)} sub={rel(metrics.gammaFlip)} accent="spot" icon={Activity} />
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
  return (
    <div className="flex flex-col gap-1 rounded-lg border border-border bg-card px-3 py-2.5">
      <span className="flex items-center gap-1 text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
        {Icon && <Icon className={cn('size-2.5', iconCls)} />}
        {label}
      </span>
      <span
        className={cn(
          'font-mono text-lg font-semibold tabular-nums leading-none',
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
            'rounded px-2 py-1 text-[11px] font-medium whitespace-nowrap transition-colors',
            value === o.value ? 'bg-background text-foreground shadow-sm' : 'text-text-muted hover:text-foreground',
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  )
}
