import { InstrumentBar } from '@/components/dashboard/instrument-bar'
import { ChartPanel } from '@/components/dashboard/chart-panel'
import { InstrumentProvider } from '@/components/instrument-provider'

export default function ChartingPage() {
  return (
    <InstrumentProvider>
      <div className="flex flex-col">
        <InstrumentBar />
        <div className="p-4">
          <div className="h-[calc(100vh-180px)] min-h-[520px]">
            <ChartPanel />
          </div>
        </div>
      </div>
    </InstrumentProvider>
  )
}
