import { PageHeader } from '@/components/page-header'
import { Glossary } from '@/components/help/glossary'

export default function HelpPage() {
  return (
    <div className="mx-auto max-w-4xl space-y-2 p-4 md:p-6">
      <PageHeader
        title="Help Center"
        description="Plain-English explanations of the gamma and options-flow concepts behind every Alertsify Flow level."
      />
      <Glossary />
    </div>
  )
}
