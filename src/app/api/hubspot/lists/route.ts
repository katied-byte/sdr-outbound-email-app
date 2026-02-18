import { NextResponse } from 'next/server'
import { getLists } from '@/lib/hubspot'

export async function GET() {
  try {
    // Check if token is configured
    if (!process.env.HUBSPOT_ACCESS_TOKEN) {
      console.error('HUBSPOT_ACCESS_TOKEN not configured')
      return NextResponse.json(
        { error: 'HubSpot not configured', lists: [] },
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
