import { InstrumentBar } from '@/components/dashboard/instrument-bar'
import { GexBoard } from '@/components/dashboard/gex-board'
import { FlowSummaryPanel } from '@/components/dashboard/flow-summary'
import { AiInsight } from '@/components/dashboard/ai-insight'
import { InstrumentProvider } from '@/components/instrument-provider'

export default function FlowMapPage() {
  return (
    <InstrumentProvider>
      <div className="flex flex-col">
        <InstrumentBar showExpiration={false} />
        <div className="flex flex-col gap-4 p-4">
          <GexBoard />
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <AiInsight />
            <FlowSummaryPanel />
          </div>
        </div>
      </div>
    </InstrumentProvider>
  )
}
