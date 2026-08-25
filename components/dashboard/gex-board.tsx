'use client'

import { useEffect, useState } from 'react'
import { Star, Zap, TrendingUp, ArrowDown } from 'lucide-react'
import { useFilters } from '@/components/filters-context'
import { useGexBoard } from '@/lib/uw/hooks'
import { cn } from '@/lib/utils'
import type { GexBoardColumn, GexBoardMetrics, GexBoardRow } from '@/lib/types'

// Which important level (if any) a strike represents, so it can be picked
// out with the same color the rest of Flowster already uses for that level.
type StrikeRole = 'spot' | 'flip' | 'attraction' | 'putWall' | 'grower'

const ROLE_STYLE: Record<
  StrikeRole,
  { label: string; icon: typeof Star; text: string; rowBg: string; dashed?: boolean }
> = {
  spot: { label: 'Spot', icon: Zap, text: 'text-spot', rowBg: 'bg-spot/25' },
  flip: { label: 'Gamma Flip', icon: Zap, text: 'text-spot', rowBg: 'bg-spot/10', dashed: true },
  attraction: { label: 'Attraction', icon: Star, text: 'text-attraction', rowBg: 'bg-attraction/25' },
  putWall: { label: 'Put Wall', icon: ArrowDown, text: 'text-bear', rowBg: 'bg-bear/25' },
  grower: { label: 'Grower', icon: TrendingUp, text: 'text-bull', rowBg: 'bg-bull/25' },
}

// Priority when a strike could match more than one role (spot wins, etc).
const ROLE_PRIORITY: StrikeRole[] = ['spot', 'flip', 'attraction', 'putWall', 'grower']

function roleOf(row: GexBoardRow, metrics: GexBoardMetrics): StrikeRole | null {
  const eq = (a: number, b: number) => Math.abs(a - b) < 0.005
  const matches: StrikeRole[] = []
  if (row.isSpot) matches.push('spot')
  if (eq(row.strike, metrics.gammaFlip)) matches.push('flip')
  if (eq(row.strike, metrics.callWall) || eq(row.strike, metrics.zeroDte)) matches.push('attraction')
  if (eq(row.strike, metrics.putWall)) matches.push('putWall')
  if (eq(row.strike, metrics.grower.strike)) matches.push('grower')
  if (matches.length === 0) return null
  return ROLE_PRIORITY.find((r) => matches.includes(r)) ?? matches[0]
}

// Compact dollar formatter: 1_250_000_000 -> "$1.3B", -47_500 -> "-$47.5K".
function money(v: number | null): string {
  if (v === null || v === 0) return v === 0 ? '$0' : ''
  const sign = v < 0 ? '-' : ''
  const abs = Math.abs(v)
  if (abs >= 1e9) return `${sign}$${(abs / 1e9).toFixed(1)}B`
  if (abs >= 1e6) return `${sign}$${(abs / 1e6).toFixed(1)}M`
  if (abs >= 1e3) return `${sign}$${(abs / 1e3).toFixed(0)}K`
  return `${sign}$${abs.toFixed(0)}`
}

// Same treatment as the Heat Map board: real cells get a soft glowing bar
// (bull green / bear red, fading toward its own edges) with bright bold
// text, so the two strike x expiry boards read as one consistent system
// instead of the Flow Map looking flat next to the Heat Map.
function cellVisual(v: number | null, max: number) {
  if (v === null || v === 0) {
    return { style: undefined, cls: 'text-muted-foreground/30 font-normal' }
  }
  const abs = Math.abs(v)
  const trivial = abs < Math.max(max * 0.004, 15_000)
  if (trivial) {
    return { style: undefined, cls: 'text-foreground/45 font-normal' }
  }
  const token = v > 0 ? '--bull' : '--bear'
  const huge = abs >= max * 0.55
  const core = huge ? 68 : 42
  return {
    style: {
      backgroundImage: `linear-gradient(90deg, transparent 0%, color-mix(in oklch, var(${token}) ${core}%, black) 28%, color-mix(in oklch, var(${token}) ${core}%, black) 72%, transparent 100%)`,
      ...(huge ? { boxShadow: `0 0 16px -4px color-mix(in oklch, var(${token}) 70%, transparent)` } : {}),
    },
    cls: huge ? 'text-[12px] font-extrabold text-white' : 'text-[11.5px] font-bold text-white',
  }
}

function StatCard({
  label,
  value,
  sub,
  accent,
}: {
  label: string
  value: string
  sub?: string
  accent?: 'bull' | 'bear' | 'spot' | 'attraction'
}) {
  return (
    <div className="flex flex-col gap-1 rounded-lg border border-border bg-card px-3 py-2.5">
      <span className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
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
      {sub ? (
        <span className="text-[11px] text-muted-foreground">{sub}</span>
      ) : null}
    </div>
  )
}

function StatsRow({
  metrics,
  spot,
}: {
  metrics: GexBoardMetrics
  spot: number
}) {
  const rel = (strike: number) => {
    const d = ((strike - spot) / spot) * 100
    return `${d >= 0 ? '+' : ''}${d.toFixed(1)}% vs price`
  }
  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-8">
      <StatCard
        label="Net GEX"
        value={money(metrics.netGex) || '$0'}
        sub={metrics.regime === 'positive' ? 'Calm market' : 'Volatile market'}
        accent={metrics.regime === 'positive' ? 'bull' : 'bear'}
      />
      <StatCard
        label="Put Wall"
        value={String(metrics.putWall)}
        sub={rel(metrics.putWall)}
        accent="bear"
      />
      <StatCard
        label="Attraction"
        value={String(metrics.callWall)}
        sub={rel(metrics.callWall)}
        accent="attraction"
      />
      <StatCard
        label="0DTE Attraction"
        value={String(metrics.zeroDte)}
        sub={rel(metrics.zeroDte)}
        accent="spot"
      />
      <StatCard
        label="Gamma Flip"
        value={String(metrics.gammaFlip)}
        sub={rel(metrics.gammaFlip)}
        accent="attraction"
      />
      <StatCard
        label="Grower"
        value={String(metrics.grower.strike)}
        sub={`+${metrics.grower.share}% of gamma`}
        accent="bull"
      />
      <StatCard
        label="Implied Move"
        value={`±${metrics.move}`}
        sub="today"
      />
      <StatCard label="ATM IV" value={`${metrics.atmIv}%`} />
    </div>
  )
}

function BoardLegend() {
  const items = [
    { label: 'Positive gamma (support)', cls: 'bg-bull' },
    { label: 'Negative gamma (fuel)', cls: 'bg-bear' },
    { label: '0DTE expiry', cls: 'bg-spot' },
    { label: 'Spot', cls: 'bg-spot' },
    { label: 'Attraction', cls: 'bg-attraction' },
    { label: 'Gamma Flip', cls: 'bg-spot' },
    { label: 'Put Wall', cls: 'bg-bear' },
    { label: 'Grower', cls: 'bg-bull' },
  ]
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5">
      {items.map((i) => (
        <div key={i.label} className="flex items-center gap-1.5">
          <span className={cn('size-2.5 rounded-sm', i.cls)} />
          <span className="text-[11px] text-text-muted">{i.label}</span>
        </div>
      ))}
    </div>
  )
}

// Right-hand detail rail: per-expiry breakdown for the selected strike.
function StrikeDetail({
  row,
  columns,
  spot,
  maxCellAbs,
  role,
  onClose,
}: {
  row: GexBoardRow
  columns: GexBoardColumn[]
  spot: number
  maxCellAbs: number
  role: StrikeRole | null
  onClose: () => void
}) {
  const dist = ((row.strike - spot) / spot) * 100
  const positive = row.net >= 0
  const colMax =
    Math.max(1, ...row.values.map((v) => Math.abs(v ?? 0))) || maxCellAbs
  const style = role ? ROLE_STYLE[role] : null
  const RoleIcon = style?.icon
  return (
    <aside className="flex w-full flex-col gap-3 rounded-xl border border-border bg-card p-4 xl:w-72">
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-2">
            <span
              className={cn(
                'size-2 rounded-full',
                positive ? 'bg-bull' : 'bg-bear',
              )}
            />
            <span className="font-mono text-xl font-semibold tabular-nums text-foreground">
              {row.strike}
            </span>
            {style && RoleIcon && (
              <span className={cn('flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold', style.rowBg, style.text)}>
                <RoleIcon className="size-3" />
                {style.label}
              </span>
            )}
          </div>
          <span className="text-[11px] text-text-muted">
            {dist >= 0 ? '+' : ''}
            {dist.toFixed(2)}% vs price
          </span>
        </div>
        <button
          onClick={onClose}
          className="rounded-md px-2 py-0.5 text-[11px] text-text-muted hover:bg-accent hover:text-foreground"
        >
          Close
        </button>
      </div>

      <div className="rounded-lg bg-secondary/50 px-3 py-2">
        <div className="text-[10px] uppercase tracking-wider text-text-muted">
          Aggregate net GEX
        </div>
        <div
          className={cn(
            'font-mono text-lg font-semibold tabular-nums',
            positive ? 'text-bull' : 'text-bear',
          )}
        >
          {money(row.net)}
        </div>
      </div>

      <div>
        <div className="mb-1.5 text-[10px] font-medium uppercase tracking-wider text-text-muted">
          By expiry
        </div>
        <div className="flex flex-col gap-1.5">
          {columns.map((c, i) => {
            const v = row.values[i]
            const pct = v === null ? 0 : Math.min(100, (Math.abs(v) / colMax) * 100)
            const pos = (v ?? 0) >= 0
            return (
              <div key={c.expiry} className="flex items-center gap-2">
                <span className="w-10 shrink-0 font-mono text-[10px] tabular-nums text-muted-foreground">
                  {c.label}
                </span>
                <div className="relative h-2 flex-1 rounded-full bg-muted/40">
                  <div
                    className={cn(
                      'absolute inset-y-0 left-0 rounded-full',
                      v === null ? 'bg-transparent' : pos ? 'bg-bull/70' : 'bg-bear/70',
                    )}
                    style={{ width: `${pct}%` }}
                  />
                </div>
                <span className="w-14 shrink-0 text-right font-mono text-[10px] tabular-nums text-muted-foreground">
                  {v === null ? '—' : money(v)}
                </span>
              </div>
            )
          })}
        </div>
      </div>
    </aside>
  )
}

export function GexBoard() {
  const { symbol, autoUpdate } = useFilters()
  const { board, isLoading } = useGexBoard(symbol, autoUpdate)
  const [selected, setSelected] = useState<number | null>(null)

  // Reset the selection when the symbol changes.
  useEffect(() => {
    setSelected(null)
  }, [symbol])

  if (!board) {
    return (
      <div className="flex h-64 items-center justify-center rounded-xl border border-border bg-card text-sm text-muted-foreground">
        {isLoading ? 'Loading gamma board…' : 'No gamma data available.'}
      </div>
    )
  }

  const { columns, rows, maxCellAbs, maxNetAbs, metrics, spot, live } = board
  const selectedRow =
    selected !== null ? rows.find((r) => r.strike === selected) ?? null : null

  return (
    <div className="flex flex-col gap-3">
      {/* Board header */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-baseline gap-2">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
            {board.symbol} · Gamma by strike & expiry
          </h2>
          <span className="font-mono text-sm font-semibold tabular-nums text-foreground">
            ${spot.toFixed(2)}
          </span>
        </div>
        <span
          className={cn(
            'rounded-full px-2 py-0.5 text-[11px] font-medium',
            metrics.regime === 'positive'
              ? 'bg-bull/15 text-bull'
              : 'bg-bear/15 text-bear',
          )}
        >
          {metrics.regime === 'positive' ? 'Positive Gamma' : 'Negative Gamma'}
          {live ? '' : ' · sample'}
        </span>
      </div>

      <div
        className={cn(
          'grid gap-3',
          selectedRow ? 'xl:grid-cols-[minmax(0,1fr)_auto]' : 'grid-cols-1',
        )}
      >
      {/* The table */}
      <div className="thin-scroll overflow-x-auto rounded-xl border border-border bg-card">
        <table className="w-full min-w-[720px] border-collapse">
          <thead>
            <tr className="border-b border-border">
              <th className="sticky left-0 z-10 bg-card px-3 py-2 text-left text-[11px] font-medium text-muted-foreground">
                Strike
              </th>
              {columns.map((c) => (
                <th
                  key={c.expiry}
                  className="px-2 py-2 text-center text-[11px] font-medium text-muted-foreground"
                >
                  <div className="flex flex-col items-center gap-0.5">
                    <span className="tabular-nums">{c.label}</span>
                    <span
                      className={cn(
                        'rounded px-1 text-[9px] font-semibold',
                        c.tag === '0D'
                          ? 'bg-spot/20 text-spot'
                          : 'bg-secondary text-muted-foreground',
                      )}
                    >
                      {c.tag}
                    </span>
                  </div>
                </th>
              ))}
              <th className="px-3 py-2 text-right text-[11px] font-medium text-muted-foreground">
                Net GEX by strike
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => {
              const role = roleOf(row, metrics)
              const style = role ? ROLE_STYLE[role] : null
              const Icon = style?.icon
              return (
              <tr
                key={row.strike}
                onClick={() =>
                  setSelected((s) => (s === row.strike ? null : row.strike))
                }
                className={cn(
                  'cursor-pointer border-b border-border/40 transition-colors last:border-0 hover:bg-accent/60',
                  style?.rowBg,
                  style?.dashed && 'border-y border-dashed border-spot/40',
                  selected === row.strike && 'bg-primary/10 ring-1 ring-inset ring-primary/40',
                )}
              >
                <td
                  className={cn(
                    'sticky left-0 z-10 px-3 py-1.5 font-mono text-[12px] tabular-nums',
                    selected === row.strike ? 'bg-primary/10' : style ? style.rowBg : 'bg-card',
                    style ? cn('font-bold', style.text) : 'text-muted-foreground',
                  )}
                >
                  {style && Icon ? (
                    <span className="flex items-center gap-1.5" title={style.label}>
                      <Icon className={cn('size-3 shrink-0', style.text)} />
                      {row.strike}
                      <span className="text-[9px] font-semibold uppercase tracking-wide">
                        {style.label}
                      </span>
                    </span>
                  ) : (
                    row.strike
                  )}
                </td>
                {row.values.map((v, i) => {
                  const cell = cellVisual(v, maxCellAbs)
                  return (
                    <td key={i} className="px-1 py-1 text-center" style={cell.style}>
                      <span className={cn('font-mono tabular-nums', cell.cls)}>
                        {v === null ? '·' : money(v)}
                      </span>
                    </td>
                  )
                })}
                {/* Net GEX bar */}
                <td className="px-3 py-1.5">
                  <div className="flex items-center justify-end gap-2">
                    <div className="relative h-3 flex-1">
                      {/* center axis */}
                      <div className="absolute left-1/2 top-0 h-full w-px bg-border" />
                      <div
                        className={cn(
                          'absolute top-0 h-full rounded-sm',
                          row.net >= 0 ? 'bg-bull' : 'bg-bear',
                        )}
                        style={{
                          left: row.net >= 0 ? '50%' : undefined,
                          right: row.net < 0 ? '50%' : undefined,
                          width: `${
                            (Math.abs(row.net) / maxNetAbs) * 48
                          }%`,
                        }}
                      />
                    </div>
                    <span className="w-16 text-right font-mono text-[11px] tabular-nums text-muted-foreground">
                      {money(row.net)}
                    </span>
                  </div>
                </td>
              </tr>
              )
            })}
          </tbody>
        </table>
      </div>

        {selectedRow && (
          <StrikeDetail
            row={selectedRow}
            columns={columns}
            spot={spot}
            maxCellAbs={maxCellAbs}
            role={roleOf(selectedRow, metrics)}
            onClose={() => setSelected(null)}
          />
        )}
      </div>

      {/* Legend + hint */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <BoardLegend />
        <span className="text-[11px] text-text-muted">
          {selectedRow ? 'Tap a row to change selection' : 'Tap any strike for the per-expiry breakdown'}
        </span>
      </div>

      {/* Summary stat cards */}
      <StatsRow metrics={metrics} spot={spot} />
    </div>
  )
}
