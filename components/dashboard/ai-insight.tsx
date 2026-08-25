'use client'

import { Brain } from 'lucide-react'
import { useFilters } from '@/components/filters-context'
import { useInstrumentData } from '@/components/instrument-provider'
import { getDashboardInsight } from '@/lib/mock-data'

export function AiInsight() {
  const { symbol, expiration } = useFilters()
  const { data } = useInstrumentData()
  const { text, confidence } = data?.insight ?? getDashboardInsight(symbol, expiration)

  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <div className="flex items-center gap-2">
        <Brain className="size-4 text-primary" />
        <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Alertsify Flow AI Insight
        </h3>
      </div>
      <p className="mt-3 text-sm leading-relaxed text-foreground">{text}</p>

      <div className="mt-4">
        <p className="text-xs text-muted-foreground">Confidence</p>
        <div className="mt-1 flex items-center gap-3">
          <span className="text-2xl font-bold text-bull">{confidence}%</span>
          <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-secondary">
            <div
              className="h-full rounded-full bg-bull"
              style={{ width: `${confidence}%` }}
            />
          </div>
        </div>
      </div>
    </div>
  )
}
