import { PageHeader } from '@/components/page-header'
import { FlowHeatmap } from '@/components/heatmap/flow-heatmap'

export default function HeatmapPage() {
  return (
    <div className="mx-auto max-w-[1600px] space-y-6 p-4 md:p-6">
      <PageHeader
        title="Flow Heat Map"
        description="The whole market's options flow at a glance — tile size is total premium traded, color is the call/put bias, grouped by sector."
      />
      <FlowHeatmap />
    </div>
  )
}
