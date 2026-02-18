import { createServerClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import LoginButton from '@/components/LoginButton'

export default async function Home() {
  const supabase = await createServerClient()
  const { data: { user } } = await supabase.auth.getUser()

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

          <LoginButton />
        </div>

        <p className="text-xs text-gray-400">
          Powered by HubSpot, Smartlead, and Gemini AI
        </p>
      </div>
    </main>
  )
}
