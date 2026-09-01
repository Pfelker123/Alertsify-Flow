'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { useInstrumentData } from '@/components/instrument-provider'
import { DataSourceBadge } from '@/components/data-source-badge'
import { cn } from '@/lib/utils'
import type { HeatmapCell, HeatmapGrid } from '@/lib/market/heatmap'
import type { FlowstersAnalytics, FlowstersNode } from '@/lib/analytics/types'

type DisplayMode = 'all' | 'significant' | 'nodes'
type DetailMode = 'simple' | 'advanced'

// Node type -> presentation (color token + short label). Keeps the existing
// color identity: walls green/red, attraction yellow, reversal purple,
// continuation blue.
const NODE_STYLE: Record<
  FlowstersNode['type'],
  { colorVar: string; label: string; textCls: string }
> = {
  attraction: { colorVar: 'var(--attraction)', label: 'Attraction', textCls: 'text-attraction' },
  buy_wall: { colorVar: 'var(--bull)', label: 'Buy Wall', textCls: 'text-bull' },
  sell_wall: { colorVar: 'var(--bear)', label: 'Sell Wall', textCls: 'text-bear' },
  reversal: { colorVar: 'var(--reversal)', label: 'Reversal', textCls: 'text-reversal' },
  continuation: { colorVar: 'var(--spot)', label: 'Continuation', textCls: 'text-spot' },
}

// Node priority when two nodes snap to the same strike (lower wins).
const NODE_PRIORITY: Record<FlowstersNode['type'], number> = {
  attraction: 0,
  buy_wall: 1,
  sell_wall: 1,
  reversal: 2,
  continuation: 3,
}

const LEGEND = [
  { label: 'Buy pressure', cls: 'bg-bull' },
  { label: 'Sell pressure', cls: 'bg-bear' },
  { label: 'Attraction', cls: 'bg-attraction' },
  { label: 'Reversal', cls: 'bg-reversal' },
  { label: 'Continuation', cls: 'bg-spot' },
  { label: 'Price', cls: 'bg-foreground' },
]

/** Compact signed number: 1_240_000 -> "+1.2M". */
function fmtCompact(n: number): string {
  const sign = n > 0 ? '+' : n < 0 ? '-' : ''
  const a = Math.abs(n)
  if (a >= 1e9) return `${sign}${(a / 1e9).toFixed(1)}B`
  if (a >= 1e6) return `${sign}${(a / 1e6).toFixed(1)}M`
  if (a >= 1e3) return `${sign}${(a / 1e3).toFixed(0)}K`
  return `${sign}${a.toFixed(0)}`
}

function fmtExp(iso: string) {
  const d = new Date(iso + 'T00:00:00Z')
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' })
}

function fmtTime(iso?: string) {
  if (!iso) return '—'
  const d = new Date(iso)
  return d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
}

/** Nearest strike in the grid to a target price. */
function nearest(strikes: number[], price: number) {
  let best = strikes[0]
  let bestD = Infinity
  for (const s of strikes) {
    const d = Math.abs(s - price)
    if (d < bestD) {
      bestD = d
      best = s
    }
  }
  return best
}

// Green (buy) -> red (sell) fill. Brightness scales with clamped normalized
// magnitude so a single dominant strike can't wash out the whole column.
function cellColor(pressure: number) {
  const a = Math.min(1, Math.abs(pressure) / 100)
  if (pressure > 8)
    return { backgroundColor: `color-mix(in oklch, var(--bull) ${Math.round(a * 74 + 14)}%, transparent)` }
  if (pressure < -8)
    return { backgroundColor: `color-mix(in oklch, var(--bear) ${Math.round(a * 74 + 14)}%, transparent)` }
  return { backgroundColor: 'color-mix(in oklch, var(--muted) 38%, transparent)' }
}

export function GammaMap() {
  const { envelope, analytics, meta } = useInstrumentData()
  const heatmap = envelope?.data?.heatmap as HeatmapGrid | null | undefined
  const spot = envelope?.data?.spot ?? analytics?.spot ?? 0
  const nodes = (analytics as FlowstersAnalytics | undefined)?.nodes ?? []

  const [display, setDisplay] = useState<DisplayMode>('all')
  const [detail, setDetail] = useState<DetailMode>('simple')
  const [hovered, setHovered] = useState<{ strike: number; expiration: string } | null>(null)

  // Snap each node to its nearest grid strike (priority: walls > attraction >
  // reversal > continuation). One node per strike.
  const nodeByStrike = useMemo(() => {
    const map = new Map<number, FlowstersNode>()
    if (!heatmap) return map
    for (const n of nodes) {
      const strike = nearest(heatmap.strikes, n.center)
      const existing = map.get(strike)
      if (!existing || NODE_PRIORITY[n.type] < NODE_PRIORITY[existing.type]) {
        map.set(strike, n)
      }
    }
    return map
  }, [heatmap, nodes])

  const cellAt = useMemo(() => {
    const m = new Map<string, HeatmapCell>()
    for (const c of heatmap?.cells ?? []) m.set(`${c.strike}|${c.expiration}`, c)
    return m
  }, [heatmap])

  const maxAbs = useMemo(() => {
    if (!heatmap) return 1
    return Math.max(1, ...heatmap.cells.map((c) => Math.abs(c.netGex)))
  }, [heatmap])

  // Total |net| per strike (row significance) for the "Significant" filter.
  const rowAbs = useMemo(() => {
    const m = new Map<number, number>()
    for (const c of heatmap?.cells ?? []) {
      m.set(c.strike, (m.get(c.strike) ?? 0) + Math.abs(c.netGex))
    }
    return m
  }, [heatmap])

  const priceStrike = useMemo(() => (heatmap ? nearest(heatmap.strikes, spot) : 0), [heatmap, spot])

  // Rows: high -> low, filtered by display mode. The price row and any
  // node-qualified strike are always kept so context is never lost.
  const rows = useMemo(() => {
    if (!heatmap) return [] as number[]
    const sorted = [...heatmap.strikes].sort((a, b) => b - a)
    const band = spot ? Math.max(spot * 0.06, 20) : Infinity
    let out = sorted.filter((s) => Math.abs(s - spot) <= band)
    if (out.length < 8) out = sorted

    if (display === 'nodes') {
      return out.filter((s) => nodeByStrike.has(s) || s === priceStrike)
    }
    if (display === 'significant') {
      const maxRow = Math.max(1, ...Array.from(rowAbs.values()))
      return out.filter(
        (s) =>
          nodeByStrike.has(s) ||
          s === priceStrike ||
          (rowAbs.get(s) ?? 0) / maxRow >= 0.12,
      )
    }
    return out
  }, [heatmap, spot, display, nodeByStrike, priceStrike, rowAbs])

  // Auto-center the "price now" row on load/updates.
  const scrollRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const el = scrollRef.current
    if (!el) return
    const priceEl = el.querySelector<HTMLElement>('[data-price-row="true"]')
    if (priceEl) {
      el.scrollTop = Math.max(0, priceEl.offsetTop - el.clientHeight / 2 + priceEl.clientHeight / 2)
    }
  }, [rows, priceStrike])

  // Level lists for the side panel.
  const strongest = useMemo(
    () => [...nodes].sort((a, b) => b.strength - a.strength).slice(0, 6),
    [nodes],
  )
  const structural = useMemo(
    () => nodes.filter((n) => n.structure === 'structural').sort((a, b) => b.strength - a.strength),
    [nodes],
  )
  const live = useMemo(
    () => nodes.filter((n) => n.structure === 'live').sort((a, b) => b.strength - a.strength),
    [nodes],
  )

  const hoveredCell = hovered ? cellAt.get(`${hovered.strike}|${hovered.expiration}`) : undefined
  const hoveredNode = hovered ? nodeByStrike.get(hovered.strike) : undefined

  return (
    <div className="flex h-full flex-col rounded-xl border border-border bg-card p-4">
      {/* Header */}
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-col">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Heat Map
          </h3>
          <span className="text-[10px] text-text-muted">
            Strikes vs expirations · green = buy pressure, red = sell pressure
          </span>
        </div>
        <div className="flex items-center gap-2">
          <SegmentedControl<DisplayMode>
            value={display}
            onChange={setDisplay}
            options={[
              { value: 'all', label: 'All' },
              { value: 'significant', label: 'Significant' },
              { value: 'nodes', label: 'Top Nodes' },
            ]}
          />
          <SegmentedControl<DetailMode>
            value={detail}
            onChange={setDetail}
            options={[
              { value: 'simple', label: 'Simple' },
              { value: 'advanced', label: 'Advanced' },
            ]}
          />
          {meta && <DataSourceBadge meta={meta} />}
        </div>
      </div>

      {!heatmap || rows.length === 0 ? (
        <div className="flex flex-1 items-center justify-center rounded-lg border border-dashed border-border p-8 text-center">
          <p className="max-w-xs text-sm text-text-muted">
            {meta?.source === 'unavailable'
              ? 'Gamma exposure is unavailable — no live options data for this symbol right now.'
              : 'Loading gamma exposure…'}
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-3 lg:flex-row">
          {/* Grid */}
          <div ref={scrollRef} className="thin-scroll max-h-[460px] flex-1 overflow-auto">
            <div
              className="grid gap-0.5"
              style={{
                gridTemplateColumns: `56px repeat(${heatmap.expirations.length}, minmax(${
                  detail === 'advanced' ? 62 : 52
                }px, 1fr))`,
              }}
            >
              {/* Header row */}
              <div className="sticky left-0 top-0 z-20 bg-card pb-1 text-[10px] font-medium uppercase text-text-muted">
                Strike
              </div>
              {heatmap.expirations.map((e, i) => (
                <div
                  key={e}
                  className="sticky top-0 z-10 flex flex-col items-center bg-card pb-1 font-mono text-[10px] text-text-muted"
                >
                  <span>{fmtExp(e)}</span>
                  <span
                    className={cn(
                      'rounded px-1 text-[8px] font-semibold',
                      i === 0 ? 'bg-spot/20 text-spot' : 'bg-secondary text-muted-foreground',
                    )}
                  >
                    {i === 0 ? '0DTE' : i < 5 ? 'W' : 'M'}
                  </span>
                </div>
              ))}

              {/* Strike rows */}
              {rows.map((strike) => (
                <HeatRow
                  key={strike}
                  strike={strike}
                  node={nodeByStrike.get(strike)}
                  isPrice={strike === priceStrike}
                  expirations={heatmap.expirations}
                  cellAt={cellAt}
                  maxAbs={maxAbs}
                  detail={detail}
                  onInspect={setHovered}
                  activeCell={hovered}
                />
              ))}
            </div>
          </div>

          {/* Side panel */}
          <aside className="flex w-full shrink-0 flex-col gap-3 lg:w-60">
            <CellInspector cell={hoveredCell} node={hoveredNode} spot={spot} />
            <LevelList title="Strongest Levels" items={strongest} spot={spot} showState />
            {structural.length > 0 && (
              <LevelList title="Structural Levels" items={structural} spot={spot} />
            )}
            {live.length > 0 && <LevelList title="Live Levels" items={live} spot={spot} />}
            <div className="rounded-lg border border-border/60 bg-secondary/40 px-3 py-2 text-[10px] text-text-muted">
              <div className="flex items-center justify-between">
                <span>Data status</span>
                <span className="font-medium text-foreground">{meta?.source ?? '—'}</span>
              </div>
              <div className="mt-1 flex items-center justify-between">
                <span>Updated</span>
                <span className="font-mono tabular-nums text-foreground">
                  {fmtTime(heatmap.dataTimestamp)}
                </span>
              </div>
            </div>
          </aside>
        </div>
      )}

      {/* Legend */}
      <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1.5 border-t border-border/60 pt-3">
        {LEGEND.map((l) => (
          <div key={l.label} className="flex items-center gap-1.5">
            <span className={cn('size-2.5 rounded-sm', l.cls)} />
            <span className="text-[10px] text-text-muted">{l.label}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

function HeatRow({
  strike,
  node,
  isPrice,
  expirations,
  cellAt,
  maxAbs,
  detail,
  onInspect,
  activeCell,
}: {
  strike: number
  node?: FlowstersNode
  isPrice: boolean
  expirations: string[]
  cellAt: Map<string, HeatmapCell>
  maxAbs: number
  detail: DetailMode
  onInspect: (c: { strike: number; expiration: string } | null) => void
  activeCell: { strike: number; expiration: string } | null
}) {
  const style = node ? NODE_STYLE[node.type] : null
  return (
    <>
      {/* Strike label */}
      <div
        data-price-row={isPrice ? 'true' : undefined}
        className="sticky left-0 z-10 flex items-center gap-1 bg-card pr-1 font-mono text-[11px] tabular-nums"
      >
        {style && (
          <span
            className="size-1.5 shrink-0 rounded-full"
            style={{ backgroundColor: style.colorVar }}
            aria-hidden
          />
        )}
        <span
          className={cn(
            isPrice
              ? 'font-semibold text-spot'
              : style
                ? 'font-semibold text-foreground'
                : 'text-muted-foreground',
          )}
        >
          {strike}
        </span>
        {isPrice && <span className="sr-only">current price</span>}
      </div>

      {/* Cells */}
      {expirations.map((e) => {
        const cell = cellAt.get(`${strike}|${e}`)
        const net = cell?.netGex ?? 0
        const pressure = Math.max(-100, Math.min(100, Math.round((net / maxAbs) * 100)))
        const isActive = activeCell?.strike === strike && activeCell?.expiration === e
        const oi = (cell?.callOi ?? 0) + (cell?.putOi ?? 0)
        const vol = (cell?.callVolume ?? 0) + (cell?.putVolume ?? 0)
        return (
          <button
            key={e}
            type="button"
            onMouseEnter={() => onInspect({ strike, expiration: e })}
            onFocus={() => onInspect({ strike, expiration: e })}
            onMouseLeave={() => onInspect(null)}
            onBlur={() => onInspect(null)}
            className={cn(
              'flex flex-col items-center justify-center rounded-[3px] px-0.5 text-[9px] font-medium leading-tight tabular-nums transition-shadow',
              detail === 'advanced' ? 'h-10' : 'h-7',
              isPrice && 'ring-1 ring-inset ring-spot/70',
              isActive && 'outline outline-1 outline-foreground/70',
            )}
            style={{
              ...cellColor(pressure),
              ...(style
                ? { boxShadow: `inset 0 0 0 1px color-mix(in oklch, ${style.colorVar} 60%, transparent)` }
                : {}),
            }}
            title={`${strike} · ${fmtExp(e)} · net ${net.toLocaleString()}${
              node ? ` · ${NODE_STYLE[node.type].label}` : ''
            }`}
          >
            <span className={cn(Math.abs(pressure) < 8 ? 'text-text-muted' : 'text-foreground')}>
              {Math.abs(net) > 0 ? fmtCompact(net) : '·'}
            </span>
            {detail === 'advanced' && Math.abs(net) > 0 && (
              <span className="mt-0.5 flex items-center gap-0.5 text-[8px] text-text-muted">
                <span aria-hidden className={net >= 0 ? 'text-bull' : 'text-bear'}>
                  {net >= 0 ? '▲' : '▼'}
                </span>
                <span>{fmtCompact(oi)}oi</span>
                <span>·</span>
                <span>{fmtCompact(vol)}v</span>
              </span>
            )}
          </button>
        )
      })}
    </>
  )
}

function CellInspector({
  cell,
  node,
  spot,
}: {
  cell?: HeatmapCell
  node?: FlowstersNode
  spot: number
}) {
  if (!cell) {
    return (
      <div className="rounded-lg border border-border/60 bg-secondary/40 px-3 py-3 text-[11px] text-text-muted">
        Hover or focus a cell to inspect its full gamma metrics.
      </div>
    )
  }
  const oi = cell.callOi + cell.putOi
  const vol = cell.callVolume + cell.putVolume
  const distPct = spot ? ((cell.strike - spot) / spot) * 100 : 0
  const style = node ? NODE_STYLE[node.type] : null
  return (
    <div className="rounded-lg border border-border/60 bg-secondary/40 px-3 py-2.5 text-[11px]">
      <div className="mb-1.5 flex items-center justify-between">
        <span className="font-mono font-semibold tabular-nums text-foreground">
          {cell.strike} · {fmtExp(cell.expiration)}
        </span>
        {style && (
          <span className={cn('text-[10px] font-semibold', style.textCls)}>{style.label}</span>
        )}
      </div>
      <dl className="grid grid-cols-2 gap-x-3 gap-y-1 text-text-muted">
        <Metric label="Net GEX" value={cell.netGex.toLocaleString()} accent />
        <Metric label="Dist" value={`${distPct >= 0 ? '+' : ''}${distPct.toFixed(1)}%`} />
        <Metric label="Call GEX" value={cell.callGex.toLocaleString()} />
        <Metric label="Put GEX" value={cell.putGex.toLocaleString()} />
        <Metric label="OI" value={oi.toLocaleString()} />
        <Metric label="Volume" value={vol.toLocaleString()} />
        {node && <Metric label="State" value={node.state} />}
        {node && <Metric label="Strength" value={String(node.strength)} />}
      </dl>
    </div>
  )
}

function Metric({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-1">
      <dt>{label}</dt>
      <dd className={cn('font-mono tabular-nums', accent ? 'font-semibold text-foreground' : 'text-foreground/90')}>
        {value}
      </dd>
    </div>
  )
}

function LevelList({
  title,
  items,
  spot,
  showState,
}: {
  title: string
  items: FlowstersNode[]
  spot: number
  showState?: boolean
}) {
  if (items.length === 0) return null
  return (
    <div className="rounded-lg border border-border/60 bg-secondary/40 px-3 py-2.5">
      <h4 className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
        {title}
      </h4>
      <ul className="flex flex-col gap-1.5">
        {items.map((n) => {
          const style = NODE_STYLE[n.type]
          const distPct = spot ? ((n.center - spot) / spot) * 100 : 0
          return (
            <li key={n.id} className="flex items-center justify-between gap-2 text-[11px]">
              <span className="flex items-center gap-1.5 truncate">
                <span
                  className="size-2 shrink-0 rounded-full"
                  style={{ backgroundColor: style.colorVar }}
                  aria-hidden
                />
                <span className="font-mono font-semibold tabular-nums text-foreground">
                  {n.center.toFixed(2)}
                </span>
                <span className={cn('truncate', style.textCls)}>{style.label}</span>
              </span>
              <span className="flex shrink-0 items-center gap-1.5">
                {showState && (
                  <span className="rounded bg-background/60 px-1 text-[8px] uppercase text-text-muted">
                    {n.state}
                  </span>
                )}
                <span className="font-mono tabular-nums text-text-muted">
                  {distPct >= 0 ? '+' : ''}
                  {distPct.toFixed(1)}%
                </span>
              </span>
            </li>
          )
        })}
      </ul>
    </div>
  )
}

function SegmentedControl<T extends string>({
  value,
  onChange,
  options,
}: {
  value: T
  onChange: (v: T) => void
  options: { value: T; label: string }[]
}) {
  return (
    <div
      role="group"
      className="flex items-center gap-0.5 rounded-md border border-border/60 bg-secondary/40 p-0.5"
    >
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          aria-pressed={value === o.value}
          onClick={() => onChange(o.value)}
          className={cn(
            'rounded px-2 py-1 text-[10px] font-medium transition-colors',
            value === o.value
              ? 'bg-background text-foreground shadow-sm'
              : 'text-text-muted hover:text-foreground',
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  )
}
