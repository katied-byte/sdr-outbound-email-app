import { NextResponse } from 'next/server'
import { getEmailAccounts } from '@/lib/smartlead'

export const dynamic = 'force-dynamic'

/** All Smartlead sending accounts (for manual selection when name-match fails). */
export async function GET() {
  try {
    const accounts = await getEmailAccounts()
    return NextResponse.json({ accounts })
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Failed to fetch email accounts'
    console.error('Error fetching Smartlead email accounts:', error)
    return NextResponse.json({ error: msg, accounts: [] }, { status: 502 })
  }
}
