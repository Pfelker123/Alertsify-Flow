import type { ReactNode } from 'react'
import { FiltersProvider } from '@/components/filters-context'
import { AppSidebar } from '@/components/app-sidebar'
import { AppTopbar } from '@/components/app-topbar'
import { AlertTicker } from '@/components/alert-ticker'
import { MobileBottomNav } from '@/components/mobile-bottom-nav'

export function AppShell({ children }: { children: ReactNode }) {
  return (
    <FiltersProvider>
      <div className="flex h-screen w-full overflow-hidden bg-background">
        <AppSidebar />
        <div className="flex min-w-0 flex-1 flex-col">
          <AppTopbar />
          <main className="thin-scroll min-h-0 flex-1 overflow-y-auto pb-16 lg:pb-0">
            {children}
          </main>
          <div className="hidden lg:block">
            <AlertTicker />
          </div>
        </div>
        <MobileBottomNav />
      </div>
    </FiltersProvider>
  )
}
