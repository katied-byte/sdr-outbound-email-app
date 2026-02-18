import { SmartleadCampaign, SmartleadEmailAccount, SmartleadSequence } from '@/types'

const SMARTLEAD_API_BASE = 'https://server.smartlead.ai/api/v1'

async function smartleadFetch(endpoint: string, options: RequestInit = {}) {
  const apiKey = process.env.SMARTLEAD_API_KEY
  const separator = endpoint.includes('?') ? '&' : '?'
  const url = `${SMARTLEAD_API_BASE}${endpoint}${separator}api_key=${apiKey}`

  const response = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
  })

  if (!response.ok) {
    const error = await response.text()
    throw new Error(`Smartlead API error: ${response.status} - ${error}`)
  }

  return response.json()
}

// Campaigns
export async function getCampaigns(): Promise<SmartleadCampaign[]> {
  return smartleadFetch('/campaigns/')
}

export async function getCampaign(campaignId: number): Promise<SmartleadCampaign> {
  return smartleadFetch(`/campaigns/${campaignId}`)
}

export async function getCampaignSequences(campaignId: number): Promise<SmartleadSequence[]> {
  return smartleadFetch(`/campaigns/${campaignId}/sequences`)
}

// Email Accounts
export async function getEmailAccounts(): Promise<SmartleadEmailAccount[]> {
  return smartleadFetch('/email-accounts/')
}

export async function getCampaignEmailAccounts(campaignId: number): Promise<SmartleadEmailAccount[]> {
  return smartleadFetch(`/campaigns/${campaignId}/email-accounts`)
}

export async function addEmailAccountsToCampaign(
  campaignId: number,
  emailAccountIds: number[]
): Promise<void> {
  await smartleadFetch(`/campaigns/${campaignId}/email-accounts`, {
    method: 'POST',
    body: JSON.stringify({
      email_account_ids: emailAccountIds,
      auto_adjust_warmup: true,
    }),
  })
}

// Match user inboxes based on name
export async function getUserInboxes(
  firstName: string,
  lastName: string
): Promise<SmartleadEmailAccount[]> {
  const allAccounts = await getEmailAccounts()
  
  const firstNameLower = firstName.toLowerCase()
  const lastNameLower = lastName.toLowerCase()
  const fullName = `${firstNameLower}${lastNameLower}`

  return allAccounts.filter(account => {
    const emailPrefix = account.email.split('@')[0].toLowerCase()
    return (
      emailPrefix === firstNameLower ||
      emailPrefix === fullName ||
      emailPrefix.startsWith(firstNameLower)
    )
  })
}

// Lead Management
interface LeadData {
  email: string
  first_name?: string
  last_name?: string
  company_name?: string
  [key: string]: string | undefined // Custom fields
}

export async function addLeadToCampaign(
  campaignId: number,
  lead: LeadData,
  emailAccountIds?: number[]
): Promise<void> {
  const payload: {
    lead_list: LeadData[]
    settings?: { email_account_ids: number[] }
  } = {
    lead_list: [lead],
  }

  // Optionally specify which email accounts to use for this lead
  if (emailAccountIds && emailAccountIds.length > 0) {
    payload.settings = { email_account_ids: emailAccountIds }
  }

  await smartleadFetch(`/campaigns/${campaignId}/leads`, {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}

// HTML Email Formatting (from your documentation)
export function formatSmartleadHtml(html: string): string {
  return html
    // Remove leading whitespace inside div tags
    .replace(/<div>\s+/g, '<div>')
    // Remove trailing whitespace before closing div (replace with &nbsp; if needed)
    .replace(/\s+<\/div>/g, '&nbsp;</div>')
    // Fix line breaks - ensure no whitespace inside br divs
    .replace(/<div>\s*<br\s*\/?>\s*<\/div>/g, '<div><br></div>')
    // Remove newlines between tags
    .replace(/>\s+</g, '><')
    .trim()
}

export function createEmailBody(paragraphs: string[]): string {
  return paragraphs
    .map((p, i) => {
      if (i === paragraphs.length - 1) {
        return `<div>${p}</div>`
      }
      return `<div>${p}&nbsp;</div><div><br></div>`
    })
    .join('')
}

export function validateSmartleadHtml(html: string): {
  isValid: boolean
  errors: string[]
  fixedHtml: string
} {
  const errors: string[] = []

  // Check for common issues
  if (html.includes('<div>\n') || html.includes('<div> ')) {
    errors.push('Found whitespace after opening <div> tag')
  }
  if (html.includes(' </div>') && !html.includes('&nbsp;</div>')) {
    errors.push('Found space before </div> - should use &nbsp;')
  }
  if (/<div>\s*\n\s*<br/.test(html)) {
    errors.push('Found newline/whitespace inside line break div')
  }

  return {
    isValid: errors.length === 0,
    errors,
    fixedHtml: formatSmartleadHtml(html),
  }
}
