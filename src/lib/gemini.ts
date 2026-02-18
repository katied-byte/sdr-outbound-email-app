import { GoogleGenerativeAI } from '@google/generative-ai'
import { HubSpotContact, HubSpotCompany, GeneratedEmail } from '@/types'

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '')

interface LeadContext {
  contact: HubSpotContact
  company: HubSpotCompany | null
  campaignContext?: string // Description of the campaign/play
}

export async function generatePersonalizedEmail(
  context: LeadContext
): Promise<GeneratedEmail> {
  const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' })

  const { contact, company } = context
  
  // Build the context string from available data
  const contactInfo = `
Contact:
- First Name: ${contact.properties.firstname || 'Unknown'}
- Last Name: ${contact.properties.lastname || 'Unknown'}
- Job Title: ${contact.properties.jobtitle || 'Unknown'}
- Email: ${contact.properties.email || 'Unknown'}
`.trim()

  const companyInfo = company ? `
Company:
- Name: ${company.properties.name || 'Unknown'}
- Website: ${company.properties.domain || 'Unknown'}
- City: ${company.properties.city || 'Unknown'}
- State: ${company.properties.state || 'Unknown'}
- GTM Modality: ${company.properties.gtm_modality || 'N/A'}
- Business Type: ${company.properties.promptloop_modalities || 'N/A'}
- Booking Software: ${company.properties.promptloop_booking_software || 'N/A'}
- Number of Locations: ${company.properties.promptloop_number_of_locations || 'N/A'}
- Avg Daily Class Count: ${company.properties.promptloop_avg_daily_class_count || 'N/A'}
- Staff Count (Website): ${company.properties.promptloop_staff_count_website || 'N/A'}
- Staff Count (Booking Page): ${company.properties.promptloop_staff_count_booking_page || 'N/A'}
- Google Maps Rating: ${company.properties.gmaps_ratings || 'N/A'}
- Google Maps Reviews: ${company.properties.gmaps_reviews || 'N/A'}
`.trim() : 'Company information not available.'

  const prompt = `You are an expert SDR (Sales Development Representative) writing personalized cold outreach emails.

Given the following lead information, write a personalized opening for a cold email. The opening should:
1. Be 2-4 sentences max
2. Reference specific details about the lead or their company that show you did research
3. Feel genuine and human, not generic or templated
4. Create a natural transition to talking about how you can help them
5. NOT include a greeting (no "Hi [Name]" - that will be added separately)
6. NOT include any call to action or meeting request (that comes later in the template)

${contactInfo}

${companyInfo}

${context.campaignContext ? `Campaign Context: ${context.campaignContext}` : ''}

Write ONLY the personalized opening paragraph. Do not include subject lines, greetings, signatures, or calls to action.`

  const result = await model.generateContent(prompt)
  const personalizedIntro = result.response.text().trim()

  // Also generate a subject line
  const subjectPrompt = `Based on this personalized email opening, write a short, engaging subject line (max 50 characters) that feels personal and would get opened. Do not use ALL CAPS or excessive punctuation.

Opening: ${personalizedIntro}

Write ONLY the subject line, nothing else.`

  const subjectResult = await model.generateContent(subjectPrompt)
  const subject = subjectResult.response.text().trim()

  return {
    subject,
    personalizedIntro,
    fullBody: buildFullEmailBody(contact.properties.firstname || 'there', personalizedIntro),
  }
}

function buildFullEmailBody(firstName: string, personalizedIntro: string): string {
  // The full email will have:
  // 1. Greeting
  // 2. Personalized intro (AI-generated)
  // 3. Rest of template (from Smartlead campaign)
  // 4. Signature
  
  return `Hi ${firstName},

${personalizedIntro}

[Rest of email template from campaign...]

%signature%`
}

export async function regenerateEmail(
  context: LeadContext,
  feedback?: string
): Promise<GeneratedEmail> {
  // Allow regeneration with optional feedback for refinement
  const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' })

  const { contact, company } = context
  
  const contactInfo = `
Contact:
- First Name: ${contact.properties.firstname || 'Unknown'}
- Last Name: ${contact.properties.lastname || 'Unknown'}  
- Job Title: ${contact.properties.jobtitle || 'Unknown'}
`.trim()

  const companyInfo = company ? `
Company:
- Name: ${company.properties.name || 'Unknown'}
- Google Rating: ${company.properties.gmaps_ratings || 'N/A'} (${company.properties.gmaps_reviews || 'N/A'} reviews)
- Location: ${company.properties.city || ''}, ${company.properties.state || ''}
- Locations: ${company.properties.promptloop_number_of_locations || 'N/A'}
`.trim() : ''

  const prompt = `You are an expert SDR writing personalized cold outreach emails.

Write a NEW, DIFFERENT personalized opening for a cold email based on this lead:

${contactInfo}
${companyInfo}

${feedback ? `User feedback on previous version: ${feedback}` : 'Make this version feel fresh and different from typical outreach.'}

Requirements:
- 2-4 sentences max
- Reference specific details that show research
- Feel genuine, not templated
- NO greeting (no "Hi Name")
- NO call to action

Write ONLY the opening paragraph.`

  const result = await model.generateContent(prompt)
  const personalizedIntro = result.response.text().trim()

  const subjectPrompt = `Write a short subject line (max 50 chars) for this email opening. Be personal, avoid clickbait.

Opening: ${personalizedIntro}

Subject line only:`

  const subjectResult = await model.generateContent(subjectPrompt)
  const subject = subjectResult.response.text().trim()

  return {
    subject,
    personalizedIntro,
    fullBody: buildFullEmailBody(contact.properties.firstname || 'there', personalizedIntro),
  }
}
