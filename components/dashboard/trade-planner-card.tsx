'use client'

import { Star } from 'lucide-react'
import { useFilters } from '@/components/filters-context'
import { useInstrumentData } from '@/components/instrument-provider'
import { getTradePlan } from '@/lib/mock-data'
import { cn } from '@/lib/utils'

function Row({
  label,
  value,
  valueClass,
  sub,
}: {
  label: string
  value: string
  valueClass?: string
  sub?: string
}) {
  return (
    <div className="flex items-center justify-between py-1.5">
      <span className="text-sm text-muted-foreground">{label}</span>
      <div className="text-right">
        <span
          className={cn(
            'font-mono text-sm font-semibold tabular-nums',
            valueClass,
          )}
        >
          {value}
        </span>
        {sub && <p className="text-[10px] text-muted-foreground">{sub}</p>}
      </div>
    </div>
  )
}

export function TradePlannerCard() {
  const { symbol } = useFilters()
  const { data } = useInstrumentData()
  const plan = data?.tradePlan ?? getTradePlan(symbol)

  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <div className="flex items-center justify-between">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Trade Planner
        </h3>
        <span className="rounded-md bg-bull/15 px-2 py-0.5 text-[11px] font-semibold text-bull">
          {plan.setup}
        </span>
      </div>

      <div className="mt-2 divide-y divide-border/60">
        <Row label="Entry" value={plan.entry.toFixed(2)} />
        <Row label="Stop" value={plan.stop.toFixed(2)} valueClass="text-bear" />
        <Row
          label="Target 1"
          value={plan.target1.toFixed(2)}
          valueClass="text-bull"
        />
        <Row
          label="Target 2"
          value={plan.target2.toFixed(2)}
          valueClass="text-bull"
        />
        <Row label="Risk/Reward" value={`${plan.riskReward.toFixed(1)} : 1`} />
        <Row label="Confidence" value={`${plan.confidence}%`} />
        <Row
          label="Suggested Option"
          value={plan.option}
          valueClass="text-bull"
          sub={plan.optionExpiry}
        />
        <Row
          label="Position Size"
          value={`${plan.positionSize} Contracts`}
          valueClass="text-bull"
          sub={`(${plan.positionPct}% of BP)`}
        />
      </div>

      <button className="mt-3 flex w-full items-center justify-center gap-2 rounded-lg border border-border bg-secondary py-2.5 text-sm font-medium text-foreground transition-colors hover:bg-accent">
        <Star className="size-4" />
        Add to Watchlist
      </button>
    </div>
  )
}
