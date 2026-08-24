'use client'

import { useMemo, useState } from 'react'
import { Search } from 'lucide-react'
import { cn } from '@/lib/utils'
import { getHeatTiles } from '@/lib/mock-data'
import type { HeatTile } from '@/lib/types'

type SortMode = 'premium' | 'unusual' | 'bias'
type GroupMode = 'sector' | 'flat'

const MIN_TILE = 84
const MAX_TILE = 190

function money(n: number): string {
  const abs = Math.abs(n)
  if (abs >= 1e9) return `$${(abs / 1e9).toFixed(2)}B`
  if (abs >= 1e6) return `$${(abs / 1e6).toFixed(1)}M`
  if (abs >= 1e3) return `$${(abs / 1e3).toFixed(0)}K`
  return `$${abs.toFixed(0)}`
}

// Tile background: intensity from unusual score, hue from call/put bias.
function tileStyle(tile: HeatTile, maxUnusual: number) {
  const heat = Math.max(0.1, Math.min(1, tile.unusualScore / Math.max(maxUnusual, 1)))
  const token = tile.netBiasPercent >= 0 ? '--bull' : '--bear'
  const strength = Math.min(1, Math.abs(tile.netBiasPercent) / 100)
  return {
    backgroundColor: `color-mix(in oklch, var(${token}) ${Math.round(14 + strength * heat * 58)}%, var(--card))`,
    borderColor: `color-mix(in oklch, var(${token}) ${Math.round(20 + strength * 40)}%, var(--border))`,
  }
}

function tileSize(premium: number, maxPremium: number) {
  const t = Math.sqrt(Math.max(premium, 0) / Math.max(maxPremium, 1))
  return Math.round(MIN_TILE + (MAX_TILE - MIN_TILE) * t)
}

export function FlowHeatmap() {
  const [tiles] = useState<HeatTile[]>(() => getHeatTiles())
  const [sort, setSort] = useState<SortMode>('premium')
  const [group, setGroup] = useState<GroupMode>('sector')
  const [query, setQuery] = useState('')
  const [selected, setSelected] = useState<HeatTile | null>(null)

  const maxPremium = useMemo(() => Math.max(1, ...tiles.map((t) => t.totalPremium)), [tiles])
  const maxUnusual = useMemo(() => Math.max(1, ...tiles.map((t) => t.unusualScore)), [tiles])

  const filtered = useMemo(() => {
    let out = tiles
    if (query.trim()) {
      const q = query.trim().toUpperCase()
      out = out.filter((t) => t.symbol.includes(q))
    }
    const sorter =
      sort === 'premium'
        ? (a: HeatTile, b: HeatTile) => b.totalPremium - a.totalPremium
        : sort === 'unusual'
          ? (a: HeatTile, b: HeatTile) => b.unusualScore - a.unusualScore
          : (a: HeatTile, b: HeatTile) => Math.abs(b.netBiasPercent) - Math.abs(a.netBiasPercent)
    return [...out].sort(sorter)
  }, [tiles, query, sort])

  const groups = useMemo(() => {
    if (group === 'flat') return [{ sector: 'All tickers', tiles: filtered }]
    const bySector = new Map<string, HeatTile[]>()
    for (const t of filtered) {
      const arr = bySector.get(t.sector) ?? []
      arr.push(t)
      bySector.set(t.sector, arr)
    }
    return Array.from(bySector.entries())
      .map(([sector, list]) => ({ sector, tiles: list }))
      .sort((a, b) => b.tiles.reduce((s, t) => s + t.totalPremium, 0) - a.tiles.reduce((s, t) => s + t.totalPremium, 0))
  }, [filtered, group])

  const marketStats = useMemo(() => {
    const totalCall = tiles.reduce((s, t) => s + t.callPremium, 0)
    const totalPut = tiles.reduce((s, t) => s + t.putPremium, 0)
    const bullish = tiles.filter((t) => t.netBiasPercent > 15).length
    const bearish = tiles.filter((t) => t.netBiasPercent < -15).length
    return { totalCall, totalPut, bullish, bearish }
  }, [tiles])

  return (
    <div className="flex flex-col gap-3">
      {/* Header stats */}
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <StatTile label="Call Premium" value={money(marketStats.totalCall)} accent="bull" />
        <StatTile label="Put Premium" value={money(marketStats.totalPut)} accent="bear" />
        <StatTile label="Bullish Tickers" value={String(marketStats.bullish)} accent="bull" sub="net bias > +15%" />
        <StatTile label="Bearish Tickers" value={String(marketStats.bearish)} accent="bear" sub="net bias < -15%" />
      </div>

      {/* Controls */}
      <div className="flex flex-wrap items-center gap-2 rounded-xl border border-border bg-card p-2.5">
        <SegmentedControl
          value={sort}
          onChange={setSort}
          options={[
            { value: 'premium', label: 'Total Premium' },
            { value: 'unusual', label: 'Unusual Score' },
            { value: 'bias', label: 'Strongest Bias' },
          ]}
        />
        <SegmentedControl
          value={group}
          onChange={setGroup}
          options={[
            { value: 'sector', label: 'By Sector' },
            { value: 'flat', label: 'Flat' },
          ]}
        />
        <div className="relative">
          <Search className="pointer-events-none absolute left-2 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value.toUpperCase())}
            placeholder="Ticker"
            className="h-7 w-28 rounded-md border border-border bg-secondary/40 pl-7 pr-2 font-mono text-[11px] uppercase tracking-wide text-foreground outline-none placeholder:text-muted-foreground focus:border-primary/50"
          />
        </div>
        <span className="ml-auto font-mono text-[11px] text-text-muted">
          Tile size = total premium · color = flow bias
        </span>
      </div>

      <div className="grid grid-cols-1 gap-3 xl:grid-cols-[minmax(0,1fr)_260px]">
        {/* Heat map */}
        <div className="flex flex-col gap-4">
          {groups.map((g) => {
            const sectorTotal = g.tiles.reduce((s, t) => s + t.totalPremium, 0)
            return (
              <div key={g.sector} className="rounded-xl border border-border bg-card p-3">
                {group === 'sector' && (
                  <div className="mb-2 flex items-center justify-between px-1">
                    <h3 className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{g.sector}</h3>
                    <span className="font-mono text-[11px] tabular-nums text-text-muted">{money(sectorTotal)}</span>
                  </div>
                )}
                <div className="flex flex-wrap gap-1.5">
                  {g.tiles.map((t) => {
                    const size = tileSize(t.totalPremium, maxPremium)
                    return (
                      <button
                        key={t.symbol}
                        type="button"
                        onClick={() => setSelected(t)}
                        style={{ width: size, height: size, ...tileStyle(t, maxUnusual) }}
                        className={cn(
                          'group relative flex flex-col justify-between overflow-hidden rounded-lg border p-2 text-left transition-transform hover:z-10 hover:scale-[1.04] hover:shadow-lg',
                          selected?.symbol === t.symbol && 'ring-2 ring-primary',
                        )}
                      >
                        <div className="flex items-start justify-between gap-1">
                          <span className="font-mono text-[13px] font-bold leading-none text-foreground">{t.symbol}</span>
                          {t.sweepCount > 0 && (
                            <span className="rounded bg-spot/20 px-1 text-[8px] font-bold text-spot">{t.sweepCount}sw</span>
                          )}
                        </div>
                        <div>
                          <span
                            className={cn(
                              'block font-mono text-[10px] font-semibold tabular-nums',
                              t.changePercent >= 0 ? 'text-bull' : 'text-bear',
                            )}
                          >
                            {t.changePercent >= 0 ? '+' : ''}
                            {t.changePercent.toFixed(2)}%
                          </span>
                          <span className="block font-mono text-[10px] tabular-nums text-foreground/80">{money(t.totalPremium)}</span>
                        </div>
                      </button>
                    )
                  })}
                </div>
              </div>
            )
          })}
        </div>

        {/* Detail rail */}
        <aside className="flex flex-col gap-3">
          {selected ? (
            <TileDetail tile={selected} onClose={() => setSelected(null)} />
          ) : (
            <div className="rounded-xl border border-dashed border-border bg-card/60 p-4 text-[11px] text-text-muted">
              Tap a tile to inspect call/put premium split, sector, and unusual-flow score.
            </div>
          )}
          <div className="rounded-xl border border-border bg-card p-3">
            <h4 className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Legend</h4>
            <div className="flex flex-col gap-1.5 text-[11px] text-text-muted">
              <div className="flex items-center gap-2">
                <span className="size-3 rounded-sm bg-bull/60" />
                Bullish premium tilt (calls dominant)
              </div>
              <div className="flex items-center gap-2">
                <span className="size-3 rounded-sm bg-bear/60" />
                Bearish premium tilt (puts dominant)
              </div>
              <div className="flex items-center gap-2">
                <span className="size-3 rounded-sm bg-muted" />
                Balanced / low unusual activity
              </div>
              <p className="pt-1 text-[10px] leading-relaxed">
                Tile area scales with total notional premium traded; color saturation scales with how unusual the flow is versus the ticker&apos;s average.
              </p>
            </div>
          </div>
        </aside>
      </div>
    </div>
  )
}

function TileDetail({ tile, onClose }: { tile: HeatTile; onClose: () => void }) {
  const callPct = tile.totalPremium ? Math.round((tile.callPremium / tile.totalPremium) * 100) : 0
  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <div className="flex items-start justify-between">
        <div>
          <span className="font-mono text-xl font-bold text-foreground">{tile.symbol}</span>
          <p className="text-[11px] text-text-muted">{tile.name}</p>
        </div>
        <button onClick={onClose} className="rounded-md px-2 py-0.5 text-[11px] text-text-muted hover:bg-accent hover:text-foreground">
          Close
        </button>
      </div>
      <div className="mt-3 space-y-2">
        <Row label="Sector" value={tile.sector} />
        <Row label="Price" value={`$${tile.price.toFixed(2)}`} />
        <Row
          label="Change"
          value={`${tile.changePercent >= 0 ? '+' : ''}${tile.changePercent.toFixed(2)}%`}
          valueCls={tile.changePercent >= 0 ? 'text-bull' : 'text-bear'}
        />
        <Row label="Total Premium" value={money(tile.totalPremium)} />
        <Row label="Call Premium" value={money(tile.callPremium)} valueCls="text-bull" />
        <Row label="Put Premium" value={money(tile.putPremium)} valueCls="text-bear" />
        <Row label="Unusual Score" value={`${tile.unusualScore} / 100`} />
        <Row label="Sweep Prints" value={String(tile.sweepCount)} />
      </div>
      <div className="mt-3">
        <div className="h-2 overflow-hidden rounded-full bg-bear/40">
          <div className="h-full rounded-full bg-bull" style={{ width: `${callPct}%` }} />
        </div>
        <div className="mt-1 flex justify-between text-[10px] text-text-muted">
          <span>{callPct}% calls</span>
          <span>{100 - callPct}% puts</span>
        </div>
      </div>
    </div>
  )
}

function Row({ label, value, valueCls }: { label: string; value: string; valueCls?: string }) {
  return (
    <div className="flex items-center justify-between text-[11px]">
      <span className="text-text-muted">{label}</span>
      <span className={cn('font-mono font-semibold tabular-nums text-foreground', valueCls)}>{value}</span>
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
  accent?: 'bull' | 'bear'
}) {
  return (
    <div className="flex flex-col gap-0.5 rounded-lg border border-border bg-card px-3 py-2.5">
      <span className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">{label}</span>
      <span
        className={cn(
          'font-mono text-lg font-semibold tabular-nums leading-tight',
          accent === 'bull' && 'text-bull',
          accent === 'bear' && 'text-bear',
          !accent && 'text-foreground',
        )}
      >
        {value}
      </span>
      {sub && <span className="text-[10px] text-text-muted">{sub}</span>}
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
