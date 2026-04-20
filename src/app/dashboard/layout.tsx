import { createServerClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Navbar from '@/components/Navbar'

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  let user = null
  try {
    const supabase = await createServerClient()
    const { data } = await supabase.auth.getUser()
    user = data?.user ?? null
  } catch (e) {
    console.warn('Dashboard layout: Supabase not configured or auth failed', e instanceof Error ? e.message : e)
  }

  if (!user) {
    redirect('/')
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar user={user} />
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {children}
      </main>
    </div>
  )
}
