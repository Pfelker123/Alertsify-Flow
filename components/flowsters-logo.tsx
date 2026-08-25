import { cn } from '@/lib/utils'

/**
 * Alertsify mark — an alert bell with signal/flow waves ringing out either
 * side, on the brand gradient squircle. Alert (the bell) + Flow (the waves).
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
        {/* bell */}
        <path d="M11 24 C11 14 13 6 20 6 C27 6 29 14 29 24" />
        {/* signal / flow waves ringing out */}
        <path d="M33 13 C36 16, 36 20, 33 23" />
        <path d="M7 13 C4 16, 4 20, 7 23" />
        {/* clapper */}
        <circle cx="20" cy="29" r="2.2" fill="#fff" stroke="none" />
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
