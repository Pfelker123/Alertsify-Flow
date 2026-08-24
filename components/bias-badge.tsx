import { cn } from '@/lib/utils'
import type { Bias } from '@/lib/types'

const MAP: Record<Bias, { label: string; cls: string }> = {
  bullish: { label: 'Bullish', cls: 'bg-bull/15 text-bull border-bull/30' },
  bearish: { label: 'Bearish', cls: 'bg-bear/15 text-bear border-bear/30' },
  neutral: {
    label: 'Neutral',
    cls: 'bg-muted text-muted-foreground border-border',
  },
}

export function BiasBadge({
  bias,
  className,
}: {
  bias: Bias
  className?: string
}) {
  const m = MAP[bias]
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-md border px-2 py-0.5 text-xs font-medium',
        m.cls,
        className,
      )}
    >
      {m.label}
    </span>
  )
}
