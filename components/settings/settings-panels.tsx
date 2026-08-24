'use client'

import type { ReactNode } from 'react'
import { Card } from '@/components/ui/card'
import { Switch } from '@/components/ui/switch'
import { Label } from '@/components/ui/label'
import { Separator } from '@/components/ui/separator'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { useFilters } from '@/components/filters-context'
import { TICKERS } from '@/lib/mock-data'

function Row({
  title,
  desc,
  children,
}: {
  title: string
  desc: string
  children: ReactNode
}) {
  return (
    <div className="flex items-center justify-between gap-4 py-3.5">
      <div>
        <p className="text-sm font-medium">{title}</p>
        <p className="text-xs text-muted-foreground">{desc}</p>
      </div>
      {children}
    </div>
  )
}

export function SettingsPanels() {
  const {
    simpleMode,
    setSimpleMode,
    showAttraction,
    setShowAttraction,
    showReversal,
    setShowReversal,
    showContinuation,
    setShowContinuation,
    symbol,
    setSymbol,
  } = useFilters()

  return (
    <div className="space-y-6">
      <Card className="p-5">
        <h2 className="font-semibold">Display</h2>
        <p className="text-xs text-muted-foreground">
          Make the maps easier to read.
        </p>
        <Separator className="my-2" />
        <Row
          title="Simple Mode"
          desc="Hide complex gamma numbers and show only zones, nodes, and the current price."
        >
          <Switch checked={simpleMode} onCheckedChange={setSimpleMode} />
        </Row>
        <Separator />
        <Row title="Default ticker" desc="The symbol loaded when you open the app.">
          <Select value={symbol} onValueChange={setSymbol}>
            <SelectTrigger className="w-[130px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="max-h-72">
              {TICKERS.map((t) => (
                <SelectItem key={t.symbol} value={t.symbol}>
                  {t.symbol}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Row>
      </Card>

      <Card className="p-5">
        <h2 className="font-semibold">Nodes</h2>
        <p className="text-xs text-muted-foreground">
          Choose which levels appear on the maps and chart.
        </p>
        <Separator className="my-2" />
        <Row
          title="Attraction zones"
          desc="Yellow magnet levels that pull price toward them."
        >
          <Switch checked={showAttraction} onCheckedChange={setShowAttraction} />
        </Row>
        <Separator />
        <Row
          title="Reversal nodes"
          desc="Pink levels where price tends to reject and turn."
        >
          <Switch checked={showReversal} onCheckedChange={setShowReversal} />
        </Row>
        <Separator />
        <Row
          title="Continuation nodes"
          desc="Green levels that confirm a trend when broken and held."
        >
          <Switch
            checked={showContinuation}
            onCheckedChange={setShowContinuation}
          />
        </Row>
      </Card>

      <Card className="p-5">
        <h2 className="font-semibold">Data Source</h2>
        <p className="text-xs text-muted-foreground">
          FLOWSTERS is running on sample data. Connect a live market and
          options provider to stream real prices and flow.
        </p>
        <Separator className="my-2" />
        <Row title="Provider" desc="Currently using mock data.">
          <span className="rounded-md bg-attraction/15 px-2 py-1 text-xs font-medium text-attraction">
            Demo
          </span>
        </Row>
      </Card>
    </div>
  )
}
