import { NextResponse } from 'next/server'
import { getUserInboxes } from '@/lib/smartlead'

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const firstName = searchParams.get('firstName') || ''
    const lastName = searchParams.get('lastName') || ''

    if (!firstName) {
      return NextResponse.json(
        { error: 'firstName is required' },
        { status: 400 }
      )
    }

    const inboxes = await getUserInboxes(firstName, lastName)
    return NextResponse.json({ inboxes })
  } catch (error) {
    console.error('Error fetching user inboxes:', error)
    return NextResponse.json(
      { error: 'Failed to fetch inboxes' },
      { status: 500 }
    )
  }
}
