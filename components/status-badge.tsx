import { cn } from '@/lib/utils'

export type DataStatus = 'live' | 'demo' | 'stale' | 'partial' | 'error'

const CONFIG: Record<
  DataStatus,
  { label: string; dot: string; text: string; ring: string }
> = {
  live: {
    label: 'Live',
    dot: 'bg-bull',
    text: 'text-bull',
    ring: 'border-bull/30 bg-bull/10',
  },
  demo: {
    label: 'Demo data',
    dot: 'bg-attraction',
    text: 'text-attraction',
    ring: 'border-attraction/30 bg-attraction/10',
  },
  stale: {
    label: 'Stale',
    dot: 'bg-attraction',
    text: 'text-attraction',
    ring: 'border-attraction/30 bg-attraction/10',
  },
  partial: {
    label: 'Partial',
    dot: 'bg-spot',
    text: 'text-spot',
    ring: 'border-spot/30 bg-spot/10',
  },
  error: {
    label: 'Offline',
    dot: 'bg-bear',
    text: 'text-bear',
    ring: 'border-bear/30 bg-bear/10',
  },
}

export function StatusBadge({
  status,
  label,
  pulse = true,
  className,
}: {
  status: DataStatus
  label?: string
  pulse?: boolean
  className?: string
}) {
  const c = CONFIG[status]
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-semibold',
        c.ring,
        c.text,
        className,
      )}
    >
      <span className="relative flex size-1.5">
        {pulse && status === 'live' && (
          <span
            className={cn(
              'absolute inline-flex size-full animate-ping rounded-full opacity-60',
              c.dot,
            )}
          />
        )}
        <span className={cn('relative inline-flex size-1.5 rounded-full', c.dot)} />
      </span>
      {label ?? c.label}
    </span>
  )
}
