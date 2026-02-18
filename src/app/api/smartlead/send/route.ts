import { NextResponse } from 'next/server'
import { addLeadToCampaign, formatSmartleadHtml } from '@/lib/smartlead'
import { HubSpotContact } from '@/types'

interface SendRequest {
  campaignId: number
  contact: HubSpotContact
  personalizedIntro: string
  subject: string
  inboxIds: number[]
}

export async function POST(request: Request) {
  try {
    const body: SendRequest = await request.json()
    const { campaignId, contact, personalizedIntro, subject, inboxIds } = body

    if (!campaignId || !contact || !personalizedIntro) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      )
    }

    // Format the personalized intro for Smartlead's HTML handling
    const formattedIntro = formatSmartleadHtml(
      `<div>${personalizedIntro.replace(/\n/g, '</div><div><br></div><div>')}&nbsp;</div>`
    )

    // Build the lead data with custom field for personalized intro
    const leadData = {
      email: contact.properties.email || '',
      first_name: contact.properties.firstname || '',
      last_name: contact.properties.lastname || '',
      company_name: contact.company?.properties.name || '',
      // Custom fields that can be used in Smartlead templates
      personalized_intro: formattedIntro,
      custom_subject: subject,
      // Include other useful data as custom fields
      job_title: contact.properties.jobtitle || '',
      city: contact.company?.properties.city || '',
      state: contact.company?.properties.state || '',
    }

    await addLeadToCampaign(campaignId, leadData, inboxIds)

    return NextResponse.json({ 
      success: true,
      message: 'Lead added to campaign successfully'
    })
  } catch (error) {
    console.error('Error sending to Smartlead:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to send' },
      { status: 500 }
    )
  }
}
