'use client'

import { useRouter } from 'next/navigation'
import { ArrowUpRight, ArrowDownRight, RefreshCcw, MoveRight } from 'lucide-react'
import { useFilters } from '@/components/filters-context'
import { cn } from '@/lib/utils'
import type { Signal, SignalType } from '@/lib/types'

const META: Record<
  SignalType,
  { label: string; cls: string; Icon: typeof ArrowUpRight }
> = {
  buy: { label: 'Buy Signal', cls: 'bg-bull/15 text-bull', Icon: ArrowUpRight },
  sell: { label: 'Sell Signal', cls: 'bg-bear/15 text-bear', Icon: ArrowDownRight },
  reversal: {
    label: 'Reversal',
    cls: 'bg-reversal/15 text-reversal',
    Icon: RefreshCcw,
  },
  continuation: {
    label: 'Continuation',
    cls: 'bg-bull/15 text-bull',
    Icon: MoveRight,
  },
}

export function SignalItem({ signal }: { signal: Signal }) {
  const m = META[signal.type]
  const Icon = m.Icon
  const router = useRouter()
  const { setSymbol, setFocusSignal } = useFilters()

  function openOnChart() {
    // setSymbol clears any prior focus, so set the symbol first.
    setSymbol(signal.symbol)
    setFocusSignal({
      symbol: signal.symbol,
      type: signal.type,
      price: signal.level,
      time: signal.time,
      note: signal.note,
    })
    router.push('/charting')
  }

  return (
    <button
      type="button"
      onClick={openOnChart}
      className="flex w-full items-start gap-3 rounded-xl border border-border bg-card/40 p-3 text-left transition-colors hover:border-primary/40 hover:bg-accent/40 focus:outline-none focus-visible:ring-2 focus-visible:ring-ring/40"
    >
      <div
        className={cn(
          'flex size-9 shrink-0 items-center justify-center rounded-lg',
          m.cls,
        )}
      >
        <Icon className="size-[18px]" />
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <span className="font-semibold">{signal.symbol}</span>
            <span
              className={cn(
                'rounded px-1.5 py-0.5 text-[11px] font-medium',
                m.cls,
              )}
            >
              {m.label}
            </span>
          </div>
          <span className="shrink-0 text-xs text-muted-foreground">
            {signal.time}
          </span>
        </div>
        <p className="mt-1 text-sm leading-snug text-muted-foreground">
          {signal.note}
        </p>
        <p className="mt-1 font-mono text-xs text-muted-foreground">
          Level{' '}
          <span className="font-semibold text-foreground">
            ${signal.level.toFixed(2)}
          </span>
        </p>
      </div>
    </button>
  )
}
