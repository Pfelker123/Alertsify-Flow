'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useFilters } from '@/components/filters-context'
import { useAlerts } from '@/lib/uw/hooks'
import { ALL_ALERTS } from '@/lib/mock-data'
import { cn } from '@/lib/utils'
import type { Signal, SignalType } from '@/lib/types'

const DOT: Record<SignalType, string> = {
  buy: 'bg-bull',
  sell: 'bg-bear',
  reversal: 'bg-reversal',
  continuation: 'bg-bull',
}

const VERB: Record<SignalType, string> = {
  buy: 'Bullish flow near',
  sell: 'Bearish flow near',
  reversal: 'Reversal risk at',
  continuation: 'Continuation above',
}

export function AlertTicker() {
  const router = useRouter()
  const { setSymbol, setFocusSignal } = useFilters()
  const { alerts: live } = useAlerts(undefined, 20)
  const alerts = (live && live.length ? live : ALL_ALERTS).slice(0, 12)

  function open(a: Signal) {
    setSymbol(a.symbol)
    setFocusSignal({
      symbol: a.symbol,
      type: a.type,
      price: a.level,
      time: a.time,
      note: a.note,
    })
    router.push('/charting')
  }

  return (
    <div className="flex h-11 shrink-0 items-center gap-4 border-t border-border bg-background px-4 text-sm">
      <div className="flex shrink-0 items-center gap-2">
        <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Alerts
        </span>
        <span className="flex size-5 items-center justify-center rounded-full bg-primary/15 text-[11px] font-semibold text-primary">
          {alerts.length}
        </span>
      </div>

      <div className="flex min-w-0 flex-1 items-center gap-2 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {alerts.map((a) => (
          <button
            key={a.id}
            type="button"
            onClick={() => open(a)}
            className="flex shrink-0 items-center gap-2 rounded-md px-2 py-1 transition-colors hover:bg-accent"
          >
            <span className="text-xs font-semibold">{a.symbol}</span>
            <span className={cn('size-2 rounded-full', DOT[a.type])} />
            <span className="text-xs text-foreground">
              {VERB[a.type]} {a.level}
            </span>
            <span className="text-[11px] text-muted-foreground">{a.time}</span>
          </button>
        ))}
      </div>

      <Link
        href="/alerts"
        className="shrink-0 text-xs font-medium text-primary hover:underline"
      >
        View All Alerts
      </Link>
    </div>
  )
}
