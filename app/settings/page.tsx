import { PageHeader } from '@/components/page-header'
import { SettingsPanels } from '@/components/settings/settings-panels'

export default function SettingsPage() {
  return (
    <div className="mx-auto max-w-3xl space-y-6 p-4 md:p-6">
      <PageHeader
        title="Settings"
        description="Tune how FLOWSTERS looks and which nodes it shows. These preferences carry across every map."
      />
      <SettingsPanels />
    </div>
  )
}
