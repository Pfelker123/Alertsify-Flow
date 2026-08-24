'use client'

import { useEffect, useMemo, useState } from 'react'
import { Search, SlidersHorizontal, RotateCcw } from 'lucide-react'
import { cn } from '@/lib/utils'
import { FLOW_SECTORS, getOptionsFlow, makeLiveFlowPrint } from '@/lib/mock-data'
import type { FlowAggressor, FlowPrint, FlowTradeType } from '@/lib/types'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

type SideFilter = 'all' | 'call' | 'put'
type SortMode = 'newest' | 'premium'

const SIZE_PRESETS = [0, 100_000, 250_000, 500_000, 1_000_000] as const
type SizePreset = (typeof SIZE_PRESETS)[number]

const SIZE_LABEL: Record<SizePreset, string> = {
  0: 'Any size',
  100_000: '$100K+',
  250_000: '$250K+',
  500_000: '$500K+',
  1_000_000: '$1M+',
}

const MAX_ROWS = 320
const STREAM_MS = 2600

// --- formatters -----------------------------------------------------------

function money(n: number, opts: { sign?: boolean } = {}): string {
  const sign = opts.sign && n !== 0 ? (n > 0 ? '+' : '-') : n < 0 ? '-' : ''
  const abs = Math.abs(n)
  if (abs >= 1e9) return `${sign}$${(abs / 1e9).toFixed(2)}B`
  if (abs >= 1e6) return `${sign}$${(abs / 1e6).toFixed(abs >= 1e7 ? 1 : 2)}M`
  if (abs >= 1e3) return `${sign}$${(abs / 1e3).toFixed(0)}K`
  return `${sign}$${abs.toFixed(0)}`
}

function compact(n: number): string {
  const abs = Math.abs(n)
  if (abs >= 1e6) return `${(n / 1e6).toFixed(1)}M`
  if (abs >= 1e3) return `${(n / 1e3).toFixed(1)}K`
  return `${n}`
}

function fmtTime(iso: string): string {
  const d = new Date(iso)
  return d.toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' })
}

function fmtAgo(iso: string): string {
  const mins = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60_000))
  if (mins < 1) return 'now'
  if (mins < 60) return `${mins}m`
  return `${Math.round(mins / 60)}h`
}

function fmtExpiry(iso: string): string {
  const d = new Date(iso + 'T00:00:00Z')
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' })
}

// --- trade type / aggressor presentation ----------------------------------

const TRADE_META: Record<FlowTradeType, { label: string; cls: string }> = {
  sweep: { label: 'SWEEP', cls: 'bg-spot/15 text-spot ring-1 ring-inset ring-spot/30' },
  block: { label: 'BLOCK', cls: 'bg-reversal/15 text-reversal ring-1 ring-inset ring-reversal/30' },
  split: { label: 'SPLIT', cls: 'bg-attraction/15 text-attraction ring-1 ring-inset ring-attraction/30' },
  trade: { label: 'TRADE', cls: 'bg-muted text-muted-foreground ring-1 ring-inset ring-border' },
}

const AGGRESSOR_META: Record<FlowAggressor, { label: string; cls: string }> = {
  ask: { label: 'ASK', cls: 'text-bull' },
  bid: { label: 'BID', cls: 'text-bear' },
  mid: { label: 'MID', cls: 'text-muted-foreground' },
}

// Row background heat, scaled by premium relative to the biggest print on screen.
function premiumHeat(premium: number, side: 'call' | 'put', max: number) {
  const a = Math.min(1, premium / Math.max(max, 1))
  if (a < 0.12) return undefined
  const token = side === 'call' ? '--bull' : '--bear'
  return {
    backgroundColor: `color-mix(in oklch, var(${token}) ${Math.round(a * 22)}%, transparent)`,
  }
}

interface Props {
  className?: string
}

export function OptionsFlowTable({ className }: Props) {
  const [seed] = useState(() => getOptionsFlow(160))
  const [prints, setPrints] = useState<FlowPrint[]>(seed)
  const [streaming, setStreaming] = useState(true)
  const [flashId, setFlashId] = useState<string | null>(null)

  const [side, setSide] = useState<SideFilter>('all')
  const [size, setSize] = useState<SizePreset>(0)
  const [sort, setSort] = useState<SortMode>('newest')
  const [query, setQuery] = useState('')
  const [sector, setSector] = useState<string>('all')
  const [shortDatedOtm, setShortDatedOtm] = useState(false)

  // Simulated live tape: prepend a fresh print on an interval.
  useEffect(() => {
    if (!streaming) return
    const id = window.setInterval(() => {
      const next = makeLiveFlowPrint()
      setPrints((prev) => [next, ...prev].slice(0, MAX_ROWS))
      setFlashId(next.id)
      window.setTimeout(() => setFlashId((cur) => (cur === next.id ? null : cur)), 1200)
    }, STREAM_MS)
    return () => window.clearInterval(id)
  }, [streaming])

  const filtered = useMemo(() => {
    let out = prints
    if (side !== 'all') out = out.filter((p) => p.side === side)
    if (size > 0) out = out.filter((p) => p.premium >= size)
    if (sector !== 'all') out = out.filter((p) => p.sector === sector)
    if (query.trim()) {
      const q = query.trim().toUpperCase()
      out = out.filter((p) => p.symbol.includes(q))
    }
    if (shortDatedOtm) out = out.filter((p) => p.dte <= 1 && p.otmPercent > 0)
    return sort === 'premium' ? [...out].sort((a, b) => b.premium - a.premium) : out
  }, [prints, side, size, sector, query, shortDatedOtm, sort])

  const stats = useMemo(() => {
    const total = prints.reduce((s, p) => s + p.premium, 0)
    const callPrem = prints.filter((p) => p.side === 'call').reduce((s, p) => s + p.premium, 0)
    const putPrem = total - callPrem
    const biggest = prints.reduce((m, p) => (p.premium > m.premium ? p : m), prints[0])
    const byTicker = new Map<string, { premium: number; count: number; latest: string }>()
    for (const p of prints) {
      const cur = byTicker.get(p.symbol) ?? { premium: 0, count: 0, latest: p.time }
      cur.premium += p.premium
      cur.count += 1
      if (new Date(p.time) > new Date(cur.latest)) cur.latest = p.time
      byTicker.set(p.symbol, cur)
    }
    const clustered = Array.from(byTicker.entries())
      .map(([symbol, v]) => ({ symbol, ...v }))
      .sort((a, b) => b.premium - a.premium)
      .slice(0, 5)
    return { total, callPrem, putPrem, biggest, clustered }
  }, [prints])

  const maxVisiblePremium = useMemo(
    () => Math.max(1, ...filtered.slice(0, 60).map((p) => p.premium)),
    [filtered],
  )

  const activeFilterCount =
    (side !== 'all' ? 1 : 0) + (size > 0 ? 1 : 0) + (sector !== 'all' ? 1 : 0) + (shortDatedOtm ? 1 : 0) + (query ? 1 : 0)

  function resetFilters() {
    setSide('all')
    setSize(0)
    setSector('all')
    setShortDatedOtm(false)
    setQuery('')
    setSort('newest')
  }

  return (
    <div className={cn('flex flex-col gap-3', className)}>
      {/* Header + live stats */}
      <div className="flex flex-col gap-3 rounded-xl border border-border bg-card p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
              Unusual Options Flow
            </h2>
            <button
              type="button"
              onClick={() => setStreaming((s) => !s)}
              className={cn(
                'flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[11px] font-semibold transition-colors',
                streaming ? 'border-bull/30 bg-bull/10 text-bull' : 'border-border bg-secondary text-muted-foreground',
              )}
            >
              <span className="relative flex size-1.5">
                {streaming && (
                  <span className="absolute inline-flex size-full animate-ping rounded-full bg-bull opacity-60" />
                )}
                <span className={cn('relative inline-flex size-1.5 rounded-full', streaming ? 'bg-bull' : 'bg-muted-foreground')} />
              </span>
              {streaming ? 'Streaming' : 'Paused'}
            </button>
          </div>
          <span className="font-mono text-[11px] text-text-muted">
            {prints.length.toLocaleString()} prints in window
          </span>
        </div>

        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          <StatTile label="Total Premium" value={money(stats.total)} sub={`${prints.length} prints`} />
          <StatTile
            label="Calls"
            value={money(stats.callPrem)}
            sub={`${stats.total ? Math.round((stats.callPrem / stats.total) * 100) : 0}% of total`}
            accent="bull"
          />
          <StatTile
            label="Puts"
            value={money(stats.putPrem)}
            sub={`${stats.total ? Math.round((stats.putPrem / stats.total) * 100) : 0}% of total`}
            accent="bear"
          />
          <StatTile
            label="Biggest Print"
            value={stats.biggest ? money(stats.biggest.premium) : '—'}
            sub={stats.biggest ? `${stats.biggest.symbol} ${stats.biggest.strike}${stats.biggest.side === 'call' ? 'C' : 'P'}` : ''}
            accent="attraction"
          />
        </div>

        {/* Clustered-now ticker chips */}
        {stats.clustered.length > 0 && (
          <div className="flex flex-wrap items-center gap-2 border-t border-border/60 pt-3">
            <span className="text-[10px] font-medium uppercase tracking-wider text-text-muted">Clustered now</span>
            {stats.clustered.map((c) => {
              const pct = Math.min(100, Math.round((c.premium / stats.clustered[0].premium) * 100))
              return (
                <button
                  key={c.symbol}
                  type="button"
                  onClick={() => setQuery(c.symbol)}
                  className="group flex items-center gap-2 overflow-hidden rounded-lg border border-border/60 bg-secondary/40 px-2.5 py-1.5 text-left transition-colors hover:border-primary/40"
                >
                  <div className="relative">
                    <span className="font-mono text-xs font-semibold text-foreground">{c.symbol}</span>
                    <div className="mt-1 h-1 w-14 overflow-hidden rounded-full bg-muted/50">
                      <div className="h-full rounded-full bg-primary" style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                  <div className="flex flex-col leading-tight">
                    <span className="font-mono text-[11px] font-semibold tabular-nums text-foreground">
                      {money(c.premium)}
                    </span>
                    <span className="font-mono text-[10px] tabular-nums text-text-muted">
                      {c.count} prints · {fmtAgo(c.latest)}
                    </span>
                  </div>
                </button>
              )
            })}
          </div>
        )}
      </div>

      {/* Filter bar */}
      <div className="flex flex-wrap items-center gap-2 rounded-xl border border-border bg-card p-2.5">
        <SegmentedControl
          value={side}
          onChange={setSide}
          options={[
            { value: 'all', label: 'Calls + Puts' },
            { value: 'call', label: 'Calls' },
            { value: 'put', label: 'Puts' },
          ]}
        />
        <SegmentedControl value={size} onChange={setSize} options={SIZE_PRESETS.map((v) => ({ value: v, label: SIZE_LABEL[v] }))} />
        <SegmentedControl
          value={sort}
          onChange={setSort}
          options={[
            { value: 'newest', label: 'Newest first' },
            { value: 'premium', label: 'Biggest premium' },
          ]}
        />

        <div className="relative">
          <Search className="pointer-events-none absolute left-2 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value.toUpperCase())}
            placeholder="Ticker"
            className="h-7 w-24 rounded-md border border-border bg-secondary/40 pl-7 pr-2 font-mono text-[11px] uppercase tracking-wide text-foreground outline-none placeholder:text-muted-foreground focus:border-primary/50"
          />
        </div>

        <Select value={sector} onValueChange={(v) => setSector(v ?? 'all')}>
          <SelectTrigger size="sm" className="h-7 text-[11px]">
            <SelectValue placeholder="All sectors" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All sectors</SelectItem>
            {FLOW_SECTORS.map((s) => (
              <SelectItem key={s} value={s}>
                {s}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <button
          type="button"
          onClick={() => setShortDatedOtm((v) => !v)}
          className={cn(
            'flex h-7 items-center gap-1.5 rounded-md border px-2.5 text-[11px] font-medium transition-colors',
            shortDatedOtm ? 'border-attraction/40 bg-attraction/10 text-attraction' : 'border-border bg-secondary/40 text-muted-foreground hover:text-foreground',
          )}
        >
          <SlidersHorizontal className="size-3" />
          0-1DTE OTM
        </button>

        <div className="ml-auto flex items-center gap-2">
          {activeFilterCount > 0 && (
            <button
              type="button"
              onClick={resetFilters}
              className="flex h-7 items-center gap-1 rounded-md px-2 text-[11px] font-medium text-muted-foreground transition-colors hover:text-foreground"
            >
              <RotateCcw className="size-3" />
              Reset ({activeFilterCount})
            </button>
          )}
          <span className="font-mono text-[11px] text-text-muted">{filtered.length} rows</span>
        </div>
      </div>

      {/* Table */}
      <div className="thin-scroll max-h-[640px] overflow-auto rounded-xl border border-border bg-card">
        <table className="w-full min-w-[900px] border-collapse">
          <thead>
            <tr className="sticky top-0 z-10 border-b border-border bg-card text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
              <th className="px-3 py-2 text-left">Time</th>
              <th className="px-3 py-2 text-left">Ticker</th>
              <th className="px-3 py-2 text-left">Contract</th>
              <th className="px-2 py-2 text-right">Price</th>
              <th className="px-3 py-2 text-right">Premium</th>
              <th className="px-2 py-2 text-right">Size</th>
              <th className="px-2 py-2 text-right">Diff</th>
              <th className="px-2 py-2 text-right">IV / Δ</th>
              <th className="px-3 py-2 text-right">Trade</th>
            </tr>
          </thead>
          <tbody>
            {filtered.slice(0, 200).map((p) => {
              const trade = TRADE_META[p.tradeType]
              const agg = AGGRESSOR_META[p.aggressor]
              const moveUp = p.moveSincePercent >= 0
              return (
                <tr
                  key={p.id}
                  style={premiumHeat(p.premium, p.side, maxVisiblePremium)}
                  className={cn(
                    'border-b border-border/40 text-[12px] transition-colors last:border-0 hover:bg-accent/50',
                    p.side === 'call' ? 'border-l-2 border-l-bull/40' : 'border-l-2 border-l-bear/40',
                    flashId === p.id && 'animate-[flow-flash_1.2s_ease-out]',
                  )}
                >
                  <td className="px-3 py-1.5 font-mono text-[11px] tabular-nums text-muted-foreground">{fmtTime(p.time)}</td>
                  <td className="px-3 py-1.5">
                    <span className="font-mono text-[12px] font-semibold text-foreground">{p.symbol}</span>
                    <span className="ml-1.5 hidden text-[10px] text-text-muted sm:inline">{p.sector}</span>
                  </td>
                  <td className="px-3 py-1.5">
                    <span className={cn('font-mono text-[12px] font-semibold tabular-nums', p.side === 'call' ? 'text-bull' : 'text-bear')}>
                      ${p.strike}
                      {p.side === 'call' ? 'C' : 'P'}
                    </span>
                    <span className="ml-1.5 font-mono text-[10px] tabular-nums text-text-muted">
                      {fmtExpiry(p.expiration)} · {p.dte}d · {p.otmPercent >= 0 ? '+' : ''}
                      {p.otmPercent.toFixed(1)}% OTM
                    </span>
                  </td>
                  <td className="px-2 py-1.5 text-right font-mono text-[12px] tabular-nums text-foreground">{p.price.toFixed(2)}</td>
                  <td className="px-3 py-1.5 text-right">
                    <span className={cn('font-mono text-[13px] font-bold tabular-nums', p.side === 'call' ? 'text-bull' : 'text-bear')}>
                      {money(p.premium)}
                    </span>
                  </td>
                  <td className="px-2 py-1.5 text-right font-mono text-[12px] tabular-nums text-muted-foreground">
                    {compact(p.size)}
                    {p.repeat > 1 && <span className="ml-1 text-[10px] text-text-muted">×{p.repeat}</span>}
                  </td>
                  <td className={cn('px-2 py-1.5 text-right font-mono text-[11px] tabular-nums', moveUp ? 'text-bull' : 'text-bear')}>
                    {moveUp ? '+' : ''}
                    {p.moveSincePercent.toFixed(1)}%
                  </td>
                  <td className="px-2 py-1.5 text-right font-mono text-[11px] tabular-nums text-muted-foreground">
                    {p.iv.toFixed(0)}% / {p.delta.toFixed(2)}
                  </td>
                  <td className="px-3 py-1.5">
                    <div className="flex items-center justify-end gap-1.5">
                      <span className={cn('text-[10px] font-semibold', agg.cls)}>{agg.label}</span>
                      <span className={cn('rounded px-1.5 py-0.5 text-[9px] font-bold tracking-wide', trade.cls)}>{trade.label}</span>
                    </div>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
        {filtered.length === 0 && (
          <p className="p-8 text-center text-sm text-muted-foreground">No prints match these filters.</p>
        )}
      </div>
    </div>
  )
}

function StatTile({
  label,
  value,
  sub,
  accent,
}: {
  label: string
  value: string
  sub?: string
  accent?: 'bull' | 'bear' | 'attraction'
}) {
  return (
    <div className="flex flex-col gap-0.5 rounded-lg border border-border bg-secondary/30 px-3 py-2">
      <span className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">{label}</span>
      <span
        className={cn(
          'font-mono text-lg font-semibold tabular-nums leading-tight',
          accent === 'bull' && 'text-bull',
          accent === 'bear' && 'text-bear',
          accent === 'attraction' && 'text-attraction',
          !accent && 'text-foreground',
        )}
      >
        {value}
      </span>
      {sub && <span className="truncate text-[10px] text-text-muted">{sub}</span>}
    </div>
  )
}

function SegmentedControl<T extends string | number>({
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
          key={String(o.value)}
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
