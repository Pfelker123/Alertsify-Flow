const LEGEND = [
  { label: 'Buying', cls: 'bg-bull' },
  { label: 'Selling', cls: 'bg-bear' },
  { label: 'Attraction', cls: 'bg-attraction' },
  { label: 'Reversal', cls: 'bg-reversal' },
  { label: 'Current Price', cls: 'bg-spot' },
  { label: 'Neutral', cls: 'bg-neutral' },
]

export function ColorLegend({ className }: { className?: string }) {
  return (
    <div className={`flex flex-wrap items-center gap-x-4 gap-y-2 ${className ?? ''}`}>
      {LEGEND.map((l) => (
        <div key={l.label} className="flex items-center gap-1.5">
          <span className={`size-2.5 rounded-sm ${l.cls}`} />
          <span className="text-xs text-muted-foreground">{l.label}</span>
        </div>
      ))}
    </div>
  )
}
