import type { NodeKind } from './types'

interface NodeStyle {
  // tailwind text/bg/border using the trading tokens
  text: string
  bg: string
  border: string
  dot: string
  hex: string // for canvas/SVG strokes
  label: string
}

export const NODE_STYLE: Record<NodeKind, NodeStyle> = {
  attraction: {
    text: 'text-attraction',
    bg: 'bg-attraction/15',
    border: 'border-attraction/50',
    dot: 'bg-attraction',
    hex: 'var(--attraction)',
    label: 'Attraction',
  },
  reversal: {
    text: 'text-reversal',
    bg: 'bg-reversal/15',
    border: 'border-reversal/50',
    dot: 'bg-reversal',
    hex: 'var(--reversal)',
    label: 'Reversal',
  },
  continuation: {
    text: 'text-bull',
    bg: 'bg-bull/12',
    border: 'border-bull/40',
    dot: 'bg-bull',
    hex: 'var(--bull)',
    label: 'Continuation',
  },
  'buy-wall': {
    text: 'text-bull',
    bg: 'bg-bull/15',
    border: 'border-bull/50',
    dot: 'bg-bull',
    hex: 'var(--bull)',
    label: 'Buy Wall',
  },
  'sell-wall': {
    text: 'text-bear',
    bg: 'bg-bear/15',
    border: 'border-bear/50',
    dot: 'bg-bear',
    hex: 'var(--bear)',
    label: 'Sell Wall',
  },
  spot: {
    text: 'text-spot',
    bg: 'bg-spot/15',
    border: 'border-spot/60',
    dot: 'bg-spot',
    hex: 'var(--spot)',
    label: 'Current Price',
  },
}

// Map a -100..100 pressure value to a cell background style.
export function pressureStyle(p: number): { bg: string; text: string } {
  const a = Math.min(1, Math.abs(p) / 100)
  if (p > 8) {
    return {
      bg: `color-mix(in oklch, var(--bull) ${Math.round(a * 80 + 10)}%, transparent)`,
      text: a > 0.55 ? 'var(--bull-foreground)' : 'var(--foreground)',
    }
  }
  if (p < -8) {
    return {
      bg: `color-mix(in oklch, var(--bear) ${Math.round(a * 80 + 10)}%, transparent)`,
      text: a > 0.55 ? 'var(--bear-foreground)' : 'var(--foreground)',
    }
  }
  return { bg: 'color-mix(in oklch, var(--muted) 40%, transparent)', text: 'var(--muted-foreground)' }
}
