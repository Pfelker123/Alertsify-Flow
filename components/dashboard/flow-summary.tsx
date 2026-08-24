'use client'

import { useFilters } from '@/components/filters-context'
import { useInstrumentData } from '@/components/instrument-provider'
import { getFlowSummary } from '@/lib/mock-data'
import { Sparkline } from '@/components/sparkline'
import { cn } from '@/lib/utils'

function GammaRow({
  label,
  value,
  spark,
  positive,
}: {
  label: string
  value: string
  spark: number[]
  positive: boolean
}) {
  return (
    <div className="flex items-center justify-between gap-3 border-b border-border/60 py-2.5">
      <div>
        <p className="text-xs text-muted-foreground">{label}</p>
        <p
          className={cn(
            'font-mono text-base font-semibold tabular-nums',
            positive ? 'text-bull' : 'text-bear',
          )}
        >
          {value}
        </p>
      </div>
      <Sparkline data={spark} positive={positive} className="h-8 w-24" />
    </div>
  )
}

const BIAS_LABEL: Record<string, string> = {
  bullish: 'Bullish',
  bearish: 'Bearish',
  neutral: 'Neutral',
}

const BIAS_CLASS: Record<string, string> = {
  bullish: 'text-bull',
  bearish: 'text-bear',
  neutral: 'text-muted-foreground',
}

// Auto-scale raw dollar gamma to K / M / B.
function fmtGamma(n: number): string {
  const sign = n >= 0 ? '+' : '-'
  const abs = Math.abs(n)
  if (abs >= 1e9) return `${sign}$${(abs / 1e9).toFixed(2)}B`
  if (abs >= 1e6) return `${sign}$${(abs / 1e6).toFixed(2)}M`
  if (abs >= 1e3) return `${sign}$${(abs / 1e3).toFixed(1)}K`
  return `${sign}$${abs.toFixed(0)}`
}

function StatRow({
  label,
  value,
  valueClass,
}: {
  label: string
  value: string
  valueClass?: string
}) {
  return (
    <div className="flex items-center justify-between border-b border-border/60 py-2.5">
      <span className="text-sm text-muted-foreground">{label}</span>
      <span
        className={cn('font-mono text-sm font-semibold tabular-nums', valueClass)}
      >
        {value}
      </span>
    </div>
  )
}

export function FlowSummaryPanel() {
  const { symbol } = useFilters()
  const { data } = useInstrumentData()
  const f = data?.summary ?? getFlowSummary(symbol)
  const flowPositive = f.callPutBias !== 'bearish'

  return (
    <div className="flex h-full flex-col rounded-xl border border-border bg-card p-4">
      <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        Flow Summary
      </h3>

      <div className="mt-2">
        <GammaRow
          label="Net Gamma (1D)"
          value={fmtGamma(f.netGamma1D)}
          spark={f.spark1D}
          positive={f.netGamma1D >= 0}
        />
        <GammaRow
          label="Net Gamma (W)"
          value={fmtGamma(f.netGammaW)}
          spark={f.sparkW}
          positive={f.netGammaW >= 0}
        />
        <div className="flex items-center justify-between gap-3 border-b border-border/60 py-2.5">
          <div>
            <p className="text-xs text-muted-foreground">Call / Put Flow</p>
            <p
              className={cn(
                'font-mono text-base font-semibold tabular-nums',
                BIAS_CLASS[f.callPutBias],
              )}
            >
              {f.callPutFlow.toFixed(2)}{' '}
              <span className="text-xs font-medium">
                ({BIAS_LABEL[f.callPutBias]})
              </span>
            </p>
          </div>
          <Sparkline data={f.sparkFlow} positive={flowPositive} className="h-8 w-24" />
        </div>

        <StatRow
          label="Dark Pool Flow"
          value={BIAS_LABEL[f.darkPool]}
          valueClass={BIAS_CLASS[f.darkPool]}
        />
        <StatRow label="Put / Call Ratio" value={f.putCallRatio.toFixed(2)} />
        <StatRow label="Implied Move (W)" value={`±${f.impliedMoveW.toFixed(2)}%`} />
      </div>
    </div>
  )
}
