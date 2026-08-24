import { PageHeader } from '@/components/page-header'
import { OptionsFlowTable } from '@/components/flow/options-flow-table'

export default function FlowPage() {
  return (
    <div className="mx-auto max-w-[1600px] space-y-6 p-4 md:p-6">
      <PageHeader
        title="Options Flow"
        description="Every unusual options print across the market, live — sweeps, blocks and splits ranked by premium so the biggest bets surface first."
      />
      <OptionsFlowTable />
    </div>
  )
}
