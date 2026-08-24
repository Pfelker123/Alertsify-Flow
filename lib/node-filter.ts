import type { NodeHorizon, PriceNode, Timeframe } from './types'

const INTRADAY_TF: Timeframe[] = ['1m', '3m', '5m', '10m', '15m', '30m', '1h']

// Which node horizons are visible for a given chart timeframe.
// - Daily timeframe -> only daily nodes
// - Weekly timeframe -> only weekly nodes
// - Any intraday timeframe -> intraday + daily nodes
export function horizonsForTimeframe(tf: Timeframe): NodeHorizon[] {
  if (tf === 'weekly') return ['weekly']
  if (tf === 'daily') return ['daily']
  return ['intraday', 'daily']
}

interface FilterOpts {
  timeframe: Timeframe
  showAttraction: boolean
  showReversal: boolean
  showContinuation: boolean
}

export function filterNodes(nodes: PriceNode[], opts: FilterOpts): PriceNode[] {
  const horizons = horizonsForTimeframe(opts.timeframe)
  return nodes.filter((n) => {
    if (!horizons.includes(n.horizon)) return false
    if (n.kind === 'attraction' && !opts.showAttraction) return false
    if (n.kind === 'reversal' && !opts.showReversal) return false
    if (n.kind === 'continuation' && !opts.showContinuation) return false
    return true
  })
}

export { INTRADAY_TF }
