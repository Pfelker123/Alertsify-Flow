import { cn } from '@/lib/utils'

/**
 * Alertsify mark — the four-petal green pinwheel, glowing on a black disc.
 */
export function FlowstersMark({ className }: { className?: string }) {
  const petal =
    'M20 20 C20 20, 19 10, 24 6 C28 3, 33 5, 33 10 C33 14, 29 17, 24 18 C22 18.5, 20.5 19, 20 20 Z'
  return (
    <span
      className={cn(
        'relative inline-flex items-center justify-center rounded-full bg-black shadow-lg shadow-brand-green/25',
        className,
      )}
      aria-hidden="true"
    >
      <svg viewBox="0 0 40 40" className="size-[76%]">
        <g fill="var(--brand-green)">
          <path d={petal} />
          <path d={petal} transform="rotate(90 20 20)" />
          <path d={petal} transform="rotate(180 20 20)" />
          <path d={petal} transform="rotate(270 20 20)" />
        </g>
      </svg>
    </span>
  )
}

/** Horizontal lockup: mark + Alertsify Flow wordmark. */
export function FlowstersLogo({
  className,
  markClassName,
  showWordmark = true,
}: {
  className?: string
  markClassName?: string
  showWordmark?: boolean
}) {
  return (
    <div className={cn('flex items-center gap-2.5', className)}>
      <FlowstersMark className={cn('size-8', markClassName)} />
      {showWordmark && (
        <span className="flex flex-col leading-none">
          <span className="text-[13.5px] font-extrabold tracking-[0.05em] text-foreground">ALERTSIFY</span>
          <span className="text-[10.5px] font-semibold tracking-[0.28em] text-brand-green">FLOW</span>
        </span>
      )}
    </div>
  )
}
