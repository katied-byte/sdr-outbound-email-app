import { createServerClient } from '@/lib/supabase/server'
import DashboardClient from '@/components/DashboardClient'

export default async function Dashboard() {
  const supabase = await createServerClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return null
  }

  // Extract user's name for inbox matching
  const fullName = user.user_metadata?.full_name || ''
  const nameParts = fullName.split(' ')
  const firstName = nameParts[0] || user.email?.split('@')[0] || ''
  const lastName = nameParts.slice(1).join(' ') || ''

  return (
    <DashboardClient
      userId={user.id}
      userEmail={user.email || ''}
      firstName={firstName}
      lastName={lastName}
    />
  )
}
