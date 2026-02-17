export default function AuthLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="min-h-screen bg-seoul-gradient flex items-center justify-center px-4 py-12">
      {children}
    </div>
  )
}
