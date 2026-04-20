import { createServerClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import LoginButton from '@/components/LoginButton'

export default async function Home({
  searchParams,
}: {
  searchParams: Record<string, string | string[] | undefined>
}) {
  const authError =
    typeof searchParams.auth_error === 'string' ? searchParams.auth_error : null

  let user = null
  try {
    const supabase = await createServerClient()
    const { data } = await supabase.auth.getUser()
    user = data?.user ?? null
  } catch (e) {
    // Supabase env missing or auth error: show login so the app still loads
    console.warn('Supabase not configured or auth failed:', e instanceof Error ? e.message : e)
  }

  if (user) {
    redirect('/dashboard')
  }

  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-8">
      <div className="max-w-md w-full space-y-8 text-center">
        <div>
          <h1 className="text-4xl font-bold text-gray-900 mb-2">
            SDR Outbound
          </h1>
          <p className="text-lg text-gray-600">
            AI-powered personalized cold email outreach
          </p>
        </div>

        <div className="bg-white rounded-xl shadow-lg p-8 space-y-6">
          <div className="space-y-2">
            <h2 className="text-xl font-semibold text-gray-800">
              Welcome back
            </h2>
            <p className="text-gray-500 text-sm">
              Sign in to start sending personalized emails
            </p>
          </div>

          {authError && (
            <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-800 text-left">
              <strong>Sign-in error:</strong> {decodeURIComponent(authError)}
            </div>
          )}
          <LoginButton />
        </div>

        <p className="text-xs text-gray-400">
          Powered by HubSpot, Smartlead, and Gemini AI
        </p>
      </div>
    </main>
  )
}
