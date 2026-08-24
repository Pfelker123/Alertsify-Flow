'use client'

import { Switch } from '@/components/ui/switch'
import { useFilters } from '@/components/filters-context'
import { cn } from '@/lib/utils'

function NodeChip({
  label,
  color,
  active,
  onClick,
}: {
  label: string
  color: string
  active: boolean
  onClick: () => void
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'flex items-center gap-1.5 rounded-md px-2 py-1 text-xs font-medium transition-opacity',
        active ? 'opacity-100' : 'opacity-40',
      )}
    >
      <span className={cn('size-2.5 rounded-full', color)} />
      {label}
    </button>
  )
}

export function ChartToggles() {
  const {
    nodesOn,
    setNodesOn,
    showAttraction,
    setShowAttraction,
    showReversal,
    setShowReversal,
    showContinuation,
    setShowContinuation,
    showSellZone,
    setShowSellZone,
    showTrails,
    setShowTrails,
    simpleMode,
    setSimpleMode,
  } = useFilters()

  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-2 border-b border-border px-3 py-2">
      <div className="flex items-center gap-2">
        <span className="text-sm font-medium">Nodes</span>
        <Switch checked={nodesOn} onCheckedChange={setNodesOn} />
      </div>

      <div className="flex items-center gap-1">
        <NodeChip
          label="Attraction"
          color="bg-attraction"
          active={nodesOn && showAttraction}
          onClick={() => setShowAttraction(!showAttraction)}
        />
        <NodeChip
          label="Reversal"
          color="bg-reversal"
          active={nodesOn && showReversal}
          onClick={() => setShowReversal(!showReversal)}
        />
        <NodeChip
          label="Continuation"
          color="bg-bull"
          active={nodesOn && showContinuation}
          onClick={() => setShowContinuation(!showContinuation)}
        />
        <NodeChip
          label="Sell Zone"
          color="bg-bear"
          active={nodesOn && showSellZone}
          onClick={() => setShowSellZone(!showSellZone)}
        />
      </div>

      <div className="ml-auto flex items-center gap-3">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium">Trails</span>
          <Switch checked={showTrails} onCheckedChange={setShowTrails} />
        </div>
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium">Simple Mode</span>
          <Switch checked={simpleMode} onCheckedChange={setSimpleMode} />
        </div>
      </div>
    </div>
  )
}
