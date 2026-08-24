'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Bell, Menu, Plus, Sun } from 'lucide-react'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { useFilters } from '@/components/filters-context'
import { StatusBadge, type DataStatus } from '@/components/status-badge'
import { TickerSearch } from '@/components/ticker-search'
import { useQuotes, useHealth } from '@/lib/uw/hooks'
import { TAPE_SYMBOLS, getTicker } from '@/lib/mock-data'
import { cn } from '@/lib/utils'
import type { Ticker } from '@/lib/types'

// Maps global API health to the top-bar provenance badge. This is the honest
// global indicator: it reflects whether the UW key is configured and whether
// upstream endpoints are actually responding, not whether mock data exists.
const HEALTH_STATUS: Record<string, DataStatus> = {
  healthy: 'live',
  degraded: 'partial',
  down: 'error',
  demo: 'demo',
  unconfigured: 'error',
  loading: 'partial',
}
const HEALTH_LABEL: Record<string, string> = {
  healthy: 'Live',
  degraded: 'Partial',
  down: 'Offline',
  demo: 'Demo data',
  unconfigured: 'No API key',
  loading: 'Checking',
}

const NAV = [
  { href: '/', label: 'Dashboard' },
  { href: '/flow-map', label: 'Flow Map' },
  { href: '/charting', label: 'Charting' },
  { href: '/alerts', label: 'Alerts' },
  { href: '/scanner', label: 'Scanner' },
  { href: '/watchlist', label: 'Watchlist' },
  { href: '/backtester', label: 'Backtester' },
  { href: '/settings', label: 'Settings' },
  { href: '/help', label: 'Help Center' },
]

function TapeItem({ symbol, quote }: { symbol: string; quote?: Ticker }) {
  const { setSymbol } = useFilters()
  const t = quote ?? getTicker(symbol)
  const up = t.changePercent >= 0
  return (
    <button
      onClick={() => setSymbol(symbol)}
      className="flex shrink-0 items-center gap-2 rounded-md px-2.5 py-1 text-left transition-colors hover:bg-accent"
    >
      <span className="text-xs font-semibold">{symbol}</span>
      <span className="font-mono text-xs tabular-nums text-muted-foreground">
        {t.price.toFixed(2)}
      </span>
      <span
        className={cn(
          'font-mono text-xs font-medium tabular-nums',
          up ? 'text-bull' : 'text-bear',
        )}
      >
        {up ? '+' : ''}
        {t.changePercent.toFixed(2)}%
      </span>
    </button>
  )
}

export function AppTopbar() {
  const pathname = usePathname()
  const { autoUpdate } = useFilters()
  const { quotes } = useQuotes(TAPE_SYMBOLS, autoUpdate)
  const { health } = useHealth()
  const quoteMap = new Map((quotes ?? []).map((q) => [q.symbol, q]))

  return (
    <header className="flex h-16 shrink-0 items-center gap-3 border-b border-border bg-background px-3 md:px-4">
      {/* Mobile nav */}
      <DropdownMenu>
        <DropdownMenuTrigger
          aria-label="Open navigation"
          className="inline-flex size-9 items-center justify-center rounded-md text-foreground hover:bg-accent lg:hidden"
        >
          <Menu className="size-5" />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-52">
          {NAV.map((n) => (
            <DropdownMenuItem
              key={n.href}
              render={
                <Link
                  href={n.href}
                  className={cn(pathname === n.href && 'font-semibold')}
                >
                  {n.label}
                </Link>
              }
            />
          ))}
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Search */}
      <TickerSearch />

      {/* Ticker tape */}
      <div className="hidden min-w-0 flex-1 items-center gap-1 overflow-x-auto md:flex [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {TAPE_SYMBOLS.map((s) => (
          <TapeItem key={s} symbol={s} quote={quoteMap.get(s)} />
        ))}
        <button
          aria-label="Add ticker"
          className="flex size-7 shrink-0 items-center justify-center rounded-md border border-border text-muted-foreground hover:bg-accent hover:text-foreground"
        >
          <Plus className="size-4" />
        </button>
      </div>

      {/* Actions */}
      <div className="ml-auto flex shrink-0 items-center gap-1.5 md:ml-0">
        <StatusBadge
          status={HEALTH_STATUS[health?.overall ?? 'loading'] ?? 'partial'}
          label={HEALTH_LABEL[health?.overall ?? 'loading']}
          pulse={health?.overall === 'healthy'}
          className="hidden sm:inline-flex"
        />
        <button
          aria-label="Toggle theme"
          className="flex size-9 items-center justify-center rounded-lg border border-border text-muted-foreground hover:bg-accent hover:text-foreground"
        >
          <Sun className="size-[18px]" />
        </button>
        <button
          aria-label="Notifications"
          className="relative flex size-9 items-center justify-center rounded-lg border border-border text-muted-foreground hover:bg-accent hover:text-foreground"
        >
          <Bell className="size-[18px]" />
          <span className="absolute -right-0.5 -top-0.5 flex size-2 rounded-full bg-bear" />
        </button>
        <div className="flex size-9 items-center justify-center rounded-full bg-bull/20 text-xs font-semibold text-bull">
          PF
        </div>
      </div>
    </header>
  )
}
