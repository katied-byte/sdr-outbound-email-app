import { createServerClient } from '@/lib/supabase/server'
import DashboardClient from '@/components/DashboardClient'
import { readHubspotLiveOutbound, readSmartleadTestOnly } from '@/lib/env-flag'
import { redirect } from 'next/navigation'

export const dynamic = 'force-dynamic'

export default async function Dashboard() {
  let user = null
  try {
    const supabase = await createServerClient()
    const { data } = await supabase.auth.getUser()
    user = data?.user ?? null
  } catch (e) {
    console.warn('Supabase not configured or auth failed:', e instanceof Error ? e.message : e)
  }

  if (!user) {
    redirect('/')
  }

  // Extract user's name for inbox matching
  const fullName = user.user_metadata?.full_name || ''
  const nameParts = fullName.split(' ')
  const firstName = nameParts[0] || user.email?.split('@')[0] || ''
  const lastName = nameParts.slice(1).join(' ') || ''

  // Use runtimeNextPublic paths so flags are not build-inlined (see env-flag.ts).
  const hubspotLive = readHubspotLiveOutbound()
  const smartleadTestOnly = readSmartleadTestOnly()

  return (
    <DashboardClient
      userId={user.id}
      userEmail={user.email || ''}
      firstName={firstName}
      lastName={lastName}
      hubspotLive={hubspotLive}
      smartleadTestOnly={smartleadTestOnly}
    />
  )
}
