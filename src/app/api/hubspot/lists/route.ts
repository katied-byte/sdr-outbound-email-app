import { unstable_noStore as noStore } from 'next/cache'
import { NextResponse } from 'next/server'
import { getLists, hubspotAccessToken } from '@/lib/hubspot'

/** Must be dynamic: static prerender runs at build time without .env.local → empty token. */
export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export async function GET() {
  noStore()
  try {
    const token = hubspotAccessToken()
    if (!token) {
      return NextResponse.json(
        {
          error:
            'HUBSPOT_ACCESS_TOKEN is empty. Create a HubSpot Private App token and add it to .env.local — see docs/HUBSPOT-SETUP.md',
          lists: [],
        },
        { status: 200 }
      )
    }

    const lists = await getLists()
    return NextResponse.json({ lists })
  } catch (error) {
    console.error('Error fetching HubSpot lists:', error)
    // Return empty lists instead of error so test mode can use mock data
    return NextResponse.json(
      { error: String(error), lists: [] },
      { status: 200 }
    )
  }
}
