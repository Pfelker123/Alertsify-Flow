'use client'

import { Activity, RefreshCcw, Zap, MoveRight } from 'lucide-react'
import { Card } from '@/components/ui/card'
import { useAlerts } from '@/lib/uw/hooks'
import { TODAY_ACTIVITY } from '@/lib/mock-data'

export function ActivityPanel() {
  const { alerts } = useAlerts(undefined, 200)

  // Derive today's activity counts from the live flow-alert feed.
  const counts = alerts?.length
    ? {
        signalsTriggered: alerts.length,
        nodesUpdated: new Set(alerts.map((a) => a.symbol)).size,
        reversalAlerts: alerts.filter((a) => a.type === 'reversal').length,
        continuationAlerts: alerts.filter((a) => a.type === 'continuation')
          .length,
      }
    : TODAY_ACTIVITY

  const ITEMS = [
    {
      label: 'Signals triggered',
      value: counts.signalsTriggered,
      Icon: Zap,
      cls: 'bg-bull/15 text-bull',
    },
    {
      label: 'Tickers active',
      value: counts.nodesUpdated,
      Icon: Activity,
      cls: 'bg-spot/15 text-spot',
    },
    {
      label: 'Reversal alerts',
      value: counts.reversalAlerts,
      Icon: RefreshCcw,
      cls: 'bg-reversal/15 text-reversal',
    },
    {
      label: 'Continuation alerts',
      value: counts.continuationAlerts,
      Icon: MoveRight,
      cls: 'bg-attraction/15 text-attraction',
    },
  ]

  return (
    <Card className="p-5">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="font-semibold">Today&apos;s Activity</h2>
        <span className="text-xs text-muted-foreground">Live</span>
      </div>
      <div className="grid grid-cols-2 gap-3">
        {ITEMS.map((it) => {
          const Icon = it.Icon
          return (
            <div
              key={it.label}
              className="rounded-xl border border-border bg-card/40 p-4"
            >
              <div
                className={`mb-3 flex size-9 items-center justify-center rounded-lg ${it.cls}`}
              >
                <Icon className="size-[18px]" />
              </div>
              <p className="font-mono text-2xl font-semibold tabular-nums">
                {it.value}
              </p>
              <p className="mt-0.5 text-xs text-muted-foreground">{it.label}</p>
            </div>
          )
        })}
      </div>
    </Card>
  )
}
