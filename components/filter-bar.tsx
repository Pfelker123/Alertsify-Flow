'use client'

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { Label } from '@/components/ui/label'
import { useFilters } from '@/components/filters-context'
import { EXPIRATIONS, TICKERS } from '@/lib/mock-data'
import type { NodeHorizon } from '@/lib/types'

interface FilterBarProps {
  showExpiration?: boolean
  showNodeView?: boolean
  showToggles?: boolean
}

function fmtExp(iso: string) {
  const d = new Date(iso)
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

const NODE_VIEWS: { value: NodeHorizon | 'all'; label: string }[] = [
  { value: 'all', label: 'All nodes' },
  { value: 'intraday', label: 'Intraday' },
  { value: 'daily', label: 'Daily only' },
  { value: 'weekly', label: 'Weekly only' },
]

export function FilterBar({
  showExpiration = true,
  showNodeView = true,
  showToggles = true,
}: FilterBarProps) {
  const {
    symbol,
    setSymbol,
    expiration,
    setExpiration,
    nodeView,
    setNodeView,
    showAttraction,
    setShowAttraction,
    showReversal,
    setShowReversal,
    showContinuation,
    setShowContinuation,
  } = useFilters()

  return (
    <div className="flex flex-wrap items-end gap-4 rounded-xl border border-border bg-card p-4">
      <div className="flex flex-col gap-1.5">
        <Label className="text-xs text-muted-foreground">Ticker</Label>
        <Select value={symbol} onValueChange={setSymbol}>
          <SelectTrigger className="w-[140px] font-semibold">
            <SelectValue />
          </SelectTrigger>
          <SelectContent className="max-h-80">
            {TICKERS.map((t) => (
              <SelectItem key={t.symbol} value={t.symbol}>
                {t.symbol}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {showExpiration && (
        <div className="flex flex-col gap-1.5">
          <Label className="text-xs text-muted-foreground">Expiration</Label>
          <Select value={expiration} onValueChange={setExpiration}>
            <SelectTrigger className="w-[130px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {EXPIRATIONS.map((e) => (
                <SelectItem key={e} value={e}>
                  {fmtExp(e)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      {showNodeView && (
        <div className="flex flex-col gap-1.5">
          <Label className="text-xs text-muted-foreground">Node view</Label>
          <Select
            value={nodeView}
            onValueChange={(v) => setNodeView(v as NodeHorizon | 'all')}
          >
            <SelectTrigger className="w-[130px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {NODE_VIEWS.map((n) => (
                <SelectItem key={n.value} value={n.value}>
                  {n.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      {showToggles && (
        <div className="ml-auto flex flex-wrap items-center gap-x-5 gap-y-2">
          <div className="flex items-center gap-2">
            <Switch
              id="t-att"
              checked={showAttraction}
              onCheckedChange={setShowAttraction}
            />
            <Label htmlFor="t-att" className="cursor-pointer text-sm text-attraction">
              Attraction
            </Label>
          </div>
          <div className="flex items-center gap-2">
            <Switch
              id="t-rev"
              checked={showReversal}
              onCheckedChange={setShowReversal}
            />
            <Label htmlFor="t-rev" className="cursor-pointer text-sm text-reversal">
              Reversal
            </Label>
          </div>
          <div className="flex items-center gap-2">
            <Switch
              id="t-cont"
              checked={showContinuation}
              onCheckedChange={setShowContinuation}
            />
            <Label htmlFor="t-cont" className="cursor-pointer text-sm text-bull">
              Continuation
            </Label>
          </div>
        </div>
      )}
    </div>
  )
}
