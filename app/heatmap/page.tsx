import { PageHeader } from '@/components/page-header'
import { GammaHeatmap } from '@/components/heatmap/gamma-heatmap'

export default function HeatmapPage() {
  return (
    <div className="mx-auto max-w-[1600px] space-y-6 p-4 md:p-6">
      <PageHeader
        title="Heat Map"
        description="Strike-by-expiry net gamma exposure, colored by dealer positioning — with Spot, Attraction, Gamma Flip and Reversal levels called out right on the board."
      />
      <GammaHeatmap />
    </div>
  )
}
