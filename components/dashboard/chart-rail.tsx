'use client'

import {
  Crosshair,
  TrendingUp,
  Minus,
  GitFork,
  SlidersHorizontal,
  PenLine,
  Type,
  ChevronDown,
  Ruler,
  ZoomIn,
  Magnet,
} from 'lucide-react'

const TOOLS = [
  { icon: Crosshair, label: 'Cursor', active: true },
  { icon: TrendingUp, label: 'Trend line' },
  { icon: Minus, label: 'Horizontal line' },
  { icon: GitFork, label: 'Fib retracement' },
  { icon: SlidersHorizontal, label: 'Measure' },
  { icon: PenLine, label: 'Brush' },
  { icon: Type, label: 'Text' },
  { icon: ChevronDown, label: 'Patterns' },
  { icon: Ruler, label: 'Ruler' },
  { icon: ZoomIn, label: 'Zoom' },
  { icon: Magnet, label: 'Magnet' },
]

export function ChartRail() {
  return (
    <div className="flex w-10 shrink-0 flex-col items-center gap-0.5 border-r border-border bg-background py-2">
      {TOOLS.map((tool) => {
        const Icon = tool.icon
        return (
          <button
            key={tool.label}
            aria-label={tool.label}
            className={`flex size-8 items-center justify-center rounded-md transition-colors ${
              tool.active
                ? 'bg-accent text-primary'
                : 'text-muted-foreground hover:bg-accent hover:text-foreground'
            }`}
          >
            <Icon className="size-[18px]" />
          </button>
        )
      })}
    </div>
  )
}
