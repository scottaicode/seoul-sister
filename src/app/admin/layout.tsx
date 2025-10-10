import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Seoul Sister Admin - Executive Dashboard',
  description: 'Manage products, analytics, and operations',
}

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="min-h-screen bg-black">
      <div className="bg-gradient-to-r from-black via-zinc-900 to-black border-b border-[#D4A574]/20">
        <div className="max-w-7xl mx-auto px-4 py-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-light text-[#D4A574] tracking-wider">
                SEOUL SISTER
              </h1>
              <p className="text-xs text-[#D4A574]/60 tracking-widest mt-1">
                EXECUTIVE DASHBOARD
              </p>
            </div>
            <div className="flex items-center gap-6">
              <div className="text-right">
                <p className="text-xs text-[#D4A574]/60 uppercase tracking-wider">Live Revenue</p>
                <p className="text-2xl font-light text-[#D4A574]">$47,892</p>
              </div>
              <div className="text-right">
                <p className="text-xs text-[#D4A574]/60 uppercase tracking-wider">Active Orders</p>
                <p className="text-2xl font-light text-[#D4A574]">23</p>
              </div>
            </div>
          </div>
        </div>
      </div>
      {children}
    </div>
  )
}