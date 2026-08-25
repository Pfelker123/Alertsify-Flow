import { cn } from '@/lib/utils'

/**
 * Flowsters wave mark — one continuous wave that rises like price and resolves
 * onto a solid node (the key level). Rendered on the brand gradient squircle.
 */
export function FlowstersMark({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        'bg-brand-gradient relative inline-flex items-center justify-center rounded-[28%] shadow-lg shadow-brand-blue/20',
        className,
      )}
      aria-hidden="true"
    >
      <svg
        viewBox="0 0 40 40"
        fill="none"
        className="size-[62%]"
        stroke="#fff"
        strokeWidth={3.6}
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        {/* rising wave */}
        <path d="M6 27 C 11 27, 12 15, 17 15 C 21 15, 22 23, 26 23" />
        {/* resolve into the node */}
        <path d="M26 23 C 29 23, 30 16, 33 14" />
        <circle cx="33.5" cy="13.5" r="2.6" fill="#fff" stroke="none" />
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
          <span className="text-[10.5px] font-semibold tracking-[0.28em] text-spot">FLOW</span>
        </span>
      )}
    </div>
  )
}
