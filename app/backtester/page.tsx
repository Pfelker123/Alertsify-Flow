import { PageHeader } from '@/components/page-header'
import { Backtester } from '@/components/backtester/backtester'

export default function BacktesterPage() {
  return (
    <div className="mx-auto max-w-6xl space-y-2 p-4 md:p-6">
      <PageHeader
        title="Research Lab"
        description="Define a node-based setup and test whether the idea has held up historically. Metrics only appear from a verified result payload — nothing here is simulated."
      />
      <Backtester />
    </div>
  )
}
