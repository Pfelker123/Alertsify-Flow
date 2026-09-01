'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  LayoutGrid,
  CandlestickChart,
  Waves,
  Bell,
  Star,
  MoreHorizontal,
} from 'lucide-react'
import { cn } from '@/lib/utils'

const ITEMS = [
  { href: '/', label: 'Home', icon: LayoutGrid, match: (p: string) => p === '/' },
  {
    href: '/charting',
    label: 'Chart',
    icon: CandlestickChart,
    match: (p: string) => p.startsWith('/charting'),
  },
  {
    href: '/flow',
    label: 'Flow',
    icon: Waves,
    match: (p: string) => p.startsWith('/flow'),
  },
  {
    href: '/alerts',
    label: 'Alerts',
    icon: Bell,
    match: (p: string) => p.startsWith('/alerts'),
  },
  {
    href: '/watchlist',
    label: 'Watch',
    icon: Star,
    match: (p: string) => p.startsWith('/watchlist'),
  },
]

const MORE = ['/heatmap', '/scanner', '/backtester', '/settings', '/help']

export function MobileBottomNav() {
  const pathname = usePathname()
  const moreActive = MORE.some((h) => pathname.startsWith(h))

  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-40 flex items-stretch border-t border-border bg-sidebar/95 pb-[env(safe-area-inset-bottom)] backdrop-blur lg:hidden"
      aria-label="Primary"
    >
      {ITEMS.map((item) => {
        const active = item.match(pathname)
        const Icon = item.icon
        return (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              'flex flex-1 flex-col items-center gap-1 py-2.5 text-[10px] font-medium transition-colors',
              active ? 'text-primary' : 'text-muted-foreground',
            )}
          >
            <Icon className="size-5" />
            {item.label}
          </Link>
        )
      })}
      <Link
        href="/scanner"
        className={cn(
          'flex flex-1 flex-col items-center gap-1 py-2.5 text-[10px] font-medium transition-colors',
          moreActive ? 'text-primary' : 'text-muted-foreground',
        )}
      >
        <MoreHorizontal className="size-5" />
        More
      </Link>
    </nav>
  )
}
