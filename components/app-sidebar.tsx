'use client'

import { useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  LayoutDashboard,
  CandlestickChart,
  Bell,
  Radar,
  Star,
  History,
  Settings,
  LifeBuoy,
  PanelLeftClose,
  PanelLeft,
  Waves,
  Flame,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { ACCOUNT } from '@/lib/mock-data'
import { LiveClock } from '@/components/live-clock'
import { FlowstersLogo, FlowstersMark } from '@/components/flowsters-logo'

const NAV = [
  { href: '/', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/flow', label: 'Options Flow', icon: Waves },
  { href: '/heatmap', label: 'Heat Map', icon: Flame },
  { href: '/charting', label: 'Charting', icon: CandlestickChart },
  { href: '/alerts', label: 'Alerts', icon: Bell },
  { href: '/scanner', label: 'Scanner', icon: Radar },
  { href: '/watchlist', label: 'Watchlist', icon: Star },
  { href: '/backtester', label: 'Backtester', icon: History },
  { href: '/settings', label: 'Settings', icon: Settings },
  { href: '/help', label: 'Help Center', icon: LifeBuoy },
]

function money(n: number) {
  return n.toLocaleString('en-US', { style: 'currency', currency: 'USD' })
}

export function AppSidebar() {
  const pathname = usePathname()
  const [collapsed, setCollapsed] = useState(false)
  const pnlUp = ACCOUNT.dayPnl >= 0

  return (
    <aside
      className={cn(
        'hidden shrink-0 flex-col border-r border-sidebar-border bg-sidebar transition-[width] duration-200 lg:flex',
        collapsed ? 'w-[68px]' : 'w-58',
      )}
    >
      <div
        className={cn(
          'flex h-16 items-center px-4',
          collapsed && 'justify-center px-0',
        )}
      >
        {collapsed ? (
          <FlowstersMark className="size-8" />
        ) : (
          <FlowstersLogo />
        )}
      </div>

      <nav className="thin-scroll flex-1 space-y-0.5 overflow-y-auto px-3 py-2">
        {NAV.map((item) => {
          const active =
            item.href === '/'
              ? pathname === '/'
              : pathname.startsWith(item.href)
          const Icon = item.icon
          return (
            <Link
              key={item.href}
              href={item.href}
              title={collapsed ? item.label : undefined}
              className={cn(
                'group relative flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
                collapsed && 'justify-center px-0',
                active
                  ? 'bg-primary/10 text-primary'
                  : 'text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-foreground',
              )}
            >
              {active && (
                <span className="absolute left-0 top-1/2 h-5 w-0.5 -translate-y-1/2 rounded-r-full bg-primary" />
              )}
              <Icon className="size-[18px] shrink-0" />
              {!collapsed && item.label}
            </Link>
          )
        })}
      </nav>

      <div
        className={cn(
          'space-y-3 border-t border-sidebar-border p-3',
          collapsed && 'px-2',
        )}
      >
        {!collapsed && (
          <>
            <div className="px-1">
              <div className="flex items-center gap-2">
                <span className="relative flex size-2">
                  <span className="absolute inline-flex size-full animate-ping rounded-full bg-bull opacity-60" />
                  <span className="relative inline-flex size-2 rounded-full bg-bull" />
                </span>
                <span className="text-xs font-semibold text-bull">
                  Market Open
                </span>
              </div>
              <p className="mt-1 font-mono text-[11px] tabular-nums text-muted-foreground">
                <LiveClock /> ET
              </p>
            </div>

            <div className="rounded-xl border border-border bg-card p-3.5">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-text-muted">
                Account ({ACCOUNT.broker})
              </p>
              <div className="mt-2 space-y-1.5">
                <div>
                  <p className="text-[11px] text-muted-foreground">
                    Buying Power
                  </p>
                  <p className="font-mono text-sm font-semibold tabular-nums">
                    {money(ACCOUNT.buyingPower)}
                  </p>
                </div>
                <div>
                  <p className="text-[11px] text-muted-foreground">Day P&amp;L</p>
                  <p
                    className={cn(
                      'font-mono text-sm font-semibold tabular-nums',
                      pnlUp ? 'text-bull' : 'text-bear',
                    )}
                  >
                    {pnlUp ? '+' : ''}
                    {money(ACCOUNT.dayPnl)} ({pnlUp ? '+' : ''}
                    {ACCOUNT.dayPnlPct.toFixed(2)}%)
                  </p>
                </div>
              </div>
              <button className="mt-3 w-full rounded-lg border border-border bg-secondary py-2 text-xs font-medium text-foreground transition-colors hover:bg-accent">
                Connect Broker
              </button>
            </div>
          </>
        )}

        <button
          onClick={() => setCollapsed((c) => !c)}
          aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          className={cn(
            'flex w-full items-center gap-2 rounded-lg px-3 py-2 text-xs font-medium text-muted-foreground transition-colors hover:bg-sidebar-accent hover:text-foreground',
            collapsed && 'justify-center px-0',
          )}
        >
          {collapsed ? (
            <PanelLeft className="size-[18px]" />
          ) : (
            <>
              <PanelLeftClose className="size-[18px]" />
              Collapse
            </>
          )}
        </button>
      </div>
    </aside>
  )
}
