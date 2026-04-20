import { NextResponse } from 'next/server'
import { generatePersonalizedEmail } from '@/lib/openai-email'
import { HubSpotContact } from '@/types'

export const dynamic = 'force-dynamic'

interface GenerateRequest {
  contact: HubSpotContact
  campaignName?: string
  senderFirstName?: string
  senderLastName?: string
}

export async function POST(request: Request) {
  try {
    if (!process.env.OPENAI_API_KEY?.trim()) {
      return NextResponse.json(
        {
          error:
            'OPENAI_API_KEY is missing. Add it in Vercel → Environment Variables (or .env.local) and redeploy.',
        },
        { status: 500 }
      )
    }

    const body: GenerateRequest = await request.json()
    const { contact, campaignName, senderFirstName, senderLastName } = body

    if (!contact) {
      return NextResponse.json({ error: 'Contact is required' }, { status: 400 })
    }

    const email = await generatePersonalizedEmail({
      contact,
      company: contact.company || null,
      campaignContext: campaignName,
      senderFirstName,
      senderLastName,
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
