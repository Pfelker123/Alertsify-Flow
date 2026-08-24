import { InstrumentBar } from '@/components/dashboard/instrument-bar'
import { ChartPanel } from '@/components/dashboard/chart-panel'
import { AiInsight } from '@/components/dashboard/ai-insight'
import { GammaLevels } from '@/components/dashboard/gamma-levels'
import { KeyLevels } from '@/components/dashboard/key-levels'
import { TradePlannerCard } from '@/components/dashboard/trade-planner-card'
import { GammaMap } from '@/components/dashboard/gamma-map'
import { FlowSummaryPanel } from '@/components/dashboard/flow-summary'
import { InstrumentProvider } from '@/components/instrument-provider'

export default function DashboardPage() {
  return (
    <InstrumentProvider>
    <div className="flex flex-col">
      <InstrumentBar />

      <div className="grid grid-cols-1 gap-4 p-4 xl:grid-cols-[minmax(0,1fr)_320px]">
        {/* Left column: chart + bottom row */}
        <div className="flex min-w-0 flex-col gap-4">
          <div className="h-[560px]">
            <ChartPanel />
          </div>
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <GammaMap />
            <FlowSummaryPanel />
          </div>
        </div>

        {/* Right column */}
        <div className="flex flex-col gap-4">
          <AiInsight />
          <GammaLevels />
          <KeyLevels />
          <TradePlannerCard />
        </div>
      </div>
    </div>
    </InstrumentProvider>
  )
}
