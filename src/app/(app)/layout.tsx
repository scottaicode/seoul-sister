import AppShell from '@/components/layout/AppShell'
import InstallPrompt from '@/components/pwa/InstallPrompt'

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <AppShell>
      {children}
      <InstallPrompt />
    </AppShell>
  )
}
