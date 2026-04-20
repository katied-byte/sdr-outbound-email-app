import { NextResponse } from 'next/server'
import {
  addEmailAccountsToCampaign,
  addLeadToCampaign,
  emailPlainTextToSmartleadHtml,
} from '@/lib/smartlead'
import { HubSpotContact } from '@/types'

export const dynamic = 'force-dynamic'

interface SendRequest {
  campaignId: number
  contact: HubSpotContact
  personalizedIntro: string
  subject: string
  inboxIds: number[]
  /** Rep sign-off; merged into personalized_intro for Smartlead (avoids fragile {{#if sender_signature}} in templates). */
  senderSignature?: string
}

export async function POST(request: Request) {
  try {
    const body: SendRequest = await request.json()
    const { campaignId, contact, personalizedIntro, subject, inboxIds, senderSignature } = body

    if (!campaignId || !contact || !personalizedIntro) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      )
    }

    // Tight HTML: single <br> between paragraphs; signature lines single-spaced in one div
    const personalizedIntroHtml = emailPlainTextToSmartleadHtml(
      personalizedIntro,
      senderSignature?.trim()
    )

    // Smartlead rejects unknown top-level keys (e.g. personalized_intro). Use custom_fields for template vars.
    const customFields: Record<string, string> = {
      personalized_intro: personalizedIntroHtml,
      custom_subject: subject,
    }
    const jt = contact.properties.jobtitle?.trim()
    if (jt) customFields.job_title = jt
    const city = contact.company?.properties.city?.trim()
    if (city) customFields.city = city
    const state = contact.company?.properties.state?.trim()
    if (state) customFields.state = state

    const leadData = {
      email: contact.properties.email || '',
      first_name: contact.properties.firstname || '',
      last_name: contact.properties.lastname || '',
      company_name: contact.company?.properties.name || '',
      custom_fields: customFields,
    }

    // Smartlead no longer allows email_account_ids on the add-leads body. Attach senders to the campaign instead.
    if (inboxIds?.length) {
      await addEmailAccountsToCampaign(campaignId, inboxIds)
    }

    const smartlead = await addLeadToCampaign(campaignId, leadData)

    const added =
      typeof smartlead.added_count === 'number'
        ? smartlead.added_count
        : smartlead.success === true
          ? 1
          : undefined
    const skipped = typeof smartlead.skipped_count === 'number' ? smartlead.skipped_count : 0

    // API can return 200 with added_count: 0 (duplicate lead, block list, etc.)
    if (added === 0) {
      return NextResponse.json(
        {
          success: false,
          error:
            'Smartlead did not add this lead (added_count: 0). Common causes: duplicate in this campaign, global block list, or validation. Open Smartlead → this campaign → Leads to confirm. Raw response is in `smartlead`.',
          smartlead,
        },
        { status: 200 }
      )
    }

    return NextResponse.json({
      success: true,
      message:
        'Lead added to the campaign in Smartlead. Emails send on Smartlead’s schedule — the campaign must be started (running) in Smartlead; delivery is not instant from this app.',
      smartlead,
      added_count: added ?? 1,
      skipped_count: skipped,
    })
  } catch (error) {
    console.error('Error sending to Smartlead:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to send' },
      { status: 500 }
    )
  }
}
