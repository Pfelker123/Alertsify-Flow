'use client'

import { ChartToggles } from '@/components/dashboard/chart-toggles'
import { ChartRail } from '@/components/dashboard/chart-rail'
import { TvChart } from '@/components/dashboard/tv-chart'

export function ChartPanel() {
  return (
    <div className="flex h-full flex-col overflow-hidden rounded-xl border border-border bg-card">
      <ChartToggles />
      <div className="flex min-h-0 flex-1">
        <ChartRail />
        <div className="flex min-w-0 flex-1 flex-col p-2">
          <div className="min-h-0 flex-1">
            <TvChart />
          </div>
        </div>
      </div>
    </div>
  )
}
