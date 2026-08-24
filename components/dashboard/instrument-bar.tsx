'use client'

import { ChevronDown, Settings } from 'lucide-react'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { useFilters } from '@/components/filters-context'
import { useInstrumentData } from '@/components/instrument-provider'
import { EXPIRY_OPTIONS, getTicker } from '@/lib/mock-data'
import { LiveClock } from '@/components/live-clock'
import { cn } from '@/lib/utils'
import type { Timeframe } from '@/lib/types'

const TF_BUTTONS: Timeframe[] = ['1m', '3m', '5m', '10m', '15m', '30m', '1h', 'daily', 'weekly']
const TF_LABEL: Record<string, string> = {
  '1m': '1m',
  '3m': '3m',
  '5m': '5m',
  '10m': '10m',
  '15m': '15m',
  '30m': '30m',
  '1h': '1H',
  daily: 'D',
  weekly: 'W',
}

export function InstrumentBar({ showExpiration = true }: { showExpiration?: boolean }) {
  const {
    symbol,
    timeframe,
    setTimeframe,
    expiration,
    setExpiration,
    autoUpdate,
  } = useFilters()
  const { data } = useInstrumentData()
  const t = data?.ticker ?? getTicker(symbol)
  const up = t.changePercent >= 0

  return (
    <div className="flex flex-wrap items-center gap-x-5 gap-y-3 border-b border-border bg-background px-4 py-3">
      {/* Symbol + price */}
      <div className="flex items-center gap-3">
        <div>
          <div className="flex items-center gap-1">
            <span className="text-xl font-bold tracking-tight">{symbol}</span>
            <ChevronDown className="size-4 text-muted-foreground" />
          </div>
          <p className="text-[11px] text-muted-foreground">{t.name}</p>
        </div>
        <div className="flex items-center gap-2">
          <span className="font-mono text-xl font-semibold tabular-nums">
            {t.price.toFixed(2)}
          </span>
          <span
            className={cn(
              'font-mono text-sm font-medium tabular-nums',
              up ? 'text-bull' : 'text-bear',
            )}
          >
            {up ? '+' : ''}
            {t.change.toFixed(2)} ({up ? '+' : ''}
            {t.changePercent.toFixed(2)}%)
          </span>
        </div>
        <span
          className={cn(
            'rounded-md px-2 py-1 text-xs font-semibold',
            up ? 'bg-bull/15 text-bull' : 'bg-bear/15 text-bear',
          )}
        >
          {up ? 'Bullish' : 'Bearish'}
        </span>
      </div>

      {/* Expiration */}
      {showExpiration && (
        <div className="flex flex-col gap-1">
          <span className="text-[10px] uppercase tracking-wider text-muted-foreground">
            Expiration
          </span>
          <Select value={expiration} onValueChange={setExpiration}>
            <SelectTrigger className="h-8 w-[160px] text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {EXPIRY_OPTIONS.map((e) => (
                <SelectItem key={e} value={e} className="text-xs">
                  {e}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      {/* Timeframe dropdown */}
      <div className="flex flex-col gap-1">
        <span className="text-[10px] uppercase tracking-wider text-muted-foreground">
          Timeframe
        </span>
        <Select
          value={timeframe}
          onValueChange={(v) => setTimeframe(v as Timeframe)}
        >
          <SelectTrigger className="h-8 w-[110px] text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {TF_BUTTONS.map((tf) => (
              <SelectItem key={tf} value={tf} className="text-xs">
                {TF_LABEL[tf]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Timeframe quick buttons */}
      <div className="flex items-center gap-0.5 self-end rounded-lg border border-border bg-secondary p-0.5">
        {TF_BUTTONS.map((tf) => (
          <button
            key={tf}
            onClick={() => setTimeframe(tf)}
            className={cn(
              'rounded-md px-2 py-1 text-xs font-medium transition-colors',
              timeframe === tf
                ? 'bg-bull/20 text-bull'
                : 'text-muted-foreground hover:text-foreground',
            )}
          >
            {TF_LABEL[tf]}
          </button>
        ))}
      </div>

      <button
        aria-label="Chart settings"
        className="flex size-8 items-center justify-center self-end rounded-lg border border-border text-muted-foreground hover:bg-accent hover:text-foreground"
      >
        <Settings className="size-4" />
      </button>

      {/* Auto update */}
      <div className="ml-auto flex items-center gap-2 self-end rounded-lg border border-border bg-card px-3 py-1.5">
        <span className="relative flex size-2">
          {autoUpdate && (
            <span className="absolute inline-flex size-full animate-ping rounded-full bg-bull opacity-60" />
          )}
          <span
            className={cn(
              'relative inline-flex size-2 rounded-full',
              autoUpdate ? 'bg-bull' : 'bg-muted-foreground',
            )}
          />
        </span>
        <div className="leading-tight">
          <p className="text-xs font-medium">
            Auto <span className="text-bull">Update</span>
          </p>
          <p className="font-mono text-[10px] text-muted-foreground">
            Last updated: <LiveClock /> ET
          </p>
        </div>
      </div>
    </div>
  )
}
