'use client'

import { Info } from 'lucide-react'
import { useFilters } from '@/components/filters-context'

// "What this means" explanation box — only shown when Simple Mode is on.
export function SimpleHint({ text }: { text: string }) {
  const { simpleMode } = useFilters()
  if (!simpleMode) return null
  return (
    <div className="flex items-start gap-3 rounded-xl border border-border bg-muted/40 p-4">
      <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-spot/15 text-spot">
        <Info className="size-[18px]" />
      </div>
      <div>
        <p className="text-sm font-medium">What this means</p>
        <p className="mt-0.5 text-sm leading-relaxed text-muted-foreground text-pretty">
          {text}
        </p>
      </div>
    </div>
  )
}
