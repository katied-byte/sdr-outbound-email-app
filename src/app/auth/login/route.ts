import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

type CookieToSet = { name: string; value: string; options: CookieOptions }

/**
 * Server-side OAuth start: sets PKCE cookies on the response, then redirects to Google.
 * Fixes client-only signInWithOAuth when cookies/storage don’t persist (button “does nothing”).
 */
export async function GET(request: NextRequest) {
  const origin = request.nextUrl.origin
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  if (!url || !key) {
    return NextResponse.redirect(`${origin}/?auth_error=${encodeURIComponent('Missing Supabase env')}`)
  }

  let cookieResponse = NextResponse.next({ request })

  const supabase = createServerClient(url, key, {
    cookies: {
      getAll() {
        return request.cookies.getAll()
      },
      setAll(cookiesToSet: CookieToSet[]) {
        cookieResponse = NextResponse.next({ request })
        cookiesToSet.forEach(({ name, value, options }) => {
          cookieResponse.cookies.set(name, value, options)
        })
      },
    },
  })

  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo: `${origin}/auth/callback`,
      skipBrowserRedirect: true,
    },
  })

  if (error) {
    return NextResponse.redirect(
      `${origin}/?auth_error=${encodeURIComponent(error.message)}`
    )
  }

  if (!data?.url) {
    return NextResponse.redirect(`${origin}/?auth_error=no_oauth_url`)
  }

  const redirect = NextResponse.redirect(data.url)
  cookieResponse.cookies.getAll().forEach((c) => {
    redirect.cookies.set(c.name, c.value)
  })

  return redirect
}
