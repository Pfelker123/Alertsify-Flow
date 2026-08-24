'use client'

import { Sparkles } from 'lucide-react'
import { useFilters } from '@/components/filters-context'
import { useInstrument } from '@/lib/uw/hooks'
import { getAiSummary, getTicker } from '@/lib/mock-data'
import { BiasBadge } from '@/components/bias-badge'

export function AiSummaryCard() {
  const { symbol, autoUpdate } = useFilters()
  const { instrument } = useInstrument(symbol, autoUpdate)
  const t = instrument?.ticker ?? getTicker(symbol)
  const summary = instrument?.aiSummary ?? getAiSummary(symbol)

  return (
    <div className="rounded-2xl border border-primary/30 bg-primary/8 p-5">
      <div className="flex items-start gap-3">
        <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/20 text-primary">
          <Sparkles className="size-5" />
        </div>
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-sm font-semibold">AI Read · {symbol}</h3>
            <BiasBadge bias={t.bias} />
          </div>
          <p className="mt-1.5 text-sm leading-relaxed text-foreground/90 text-pretty">
            {summary}
          </p>
        </div>
      </div>
    </div>
  )
}
