import { NextResponse } from 'next/server'
import { generatePersonalizedEmail } from '@/lib/gemini'
import { HubSpotContact } from '@/types'

interface GenerateRequest {
  contact: HubSpotContact
  campaignName?: string
}

export async function POST(request: Request) {
  try {
    const body: GenerateRequest = await request.json()
    const { contact, campaignName } = body

    if (!contact) {
      return NextResponse.json(
        { error: 'Contact is required' },
        { status: 400 }
      )
    }

    const email = await generatePersonalizedEmail({
      contact,
      company: contact.company || null,
      campaignContext: campaignName,
    })

    return NextResponse.json({ email })
  } catch (error) {
    console.error('Error generating email:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to generate email' },
      { status: 500 }
    )
  }
}
