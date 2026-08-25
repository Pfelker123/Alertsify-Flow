import { PageHeader } from '@/components/page-header'
import { ColorLegend } from '@/components/color-legend'
import { AlertsFeed } from '@/components/alerts/alerts-feed'

export default function AlertsPage() {
  return (
    <div className="mx-auto max-w-7xl space-y-6 p-4 md:p-6">
      <PageHeader
        title="Alerts"
        description="Every signal Alertsify Flow has fired today. Filter by buy, sell, reversal, or continuation to focus on the setups you trade."
      >
        <ColorLegend />
      </PageHeader>

      <AlertsFeed />
    </div>
  )
}
