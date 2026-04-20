import { NextResponse } from 'next/server'
import { getCampaigns } from '@/lib/smartlead'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const campaigns = await getCampaigns()
    return NextResponse.json({ campaigns })
  } catch (error) {
    console.error('Error fetching Smartlead campaigns:', error)
    const msg = error instanceof Error ? error.message : 'Failed to fetch campaigns'
    return NextResponse.json({ error: msg }, { status: 502 })
  }
}
