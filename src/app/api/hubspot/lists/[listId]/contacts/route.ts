import { unstable_noStore as noStore } from 'next/cache'
import { NextResponse } from 'next/server'
import { getListContacts, enrichContactsWithCompanies } from '@/lib/hubspot'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export async function GET(
  request: Request,
  { params }: { params: Promise<{ listId: string }> }
) {
  noStore()
  try {
    const { listId } = await params
    const listIdNum = parseInt(listId, 10)
    
    if (isNaN(listIdNum)) {
      return NextResponse.json(
        { error: 'Invalid list ID' },
        { status: 400 }
      )
    }

    const contacts = await getListContacts(listIdNum)
    const enrichedContacts = await enrichContactsWithCompanies(contacts)
    
    return NextResponse.json({ contacts: enrichedContacts })
  } catch (error) {
    console.error('Error fetching contacts:', error)
    return NextResponse.json(
      { error: 'Failed to fetch contacts' },
      { status: 500 }
    )
  }
}
