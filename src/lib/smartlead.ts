import { SmartleadCampaign, SmartleadEmailAccount, SmartleadSequence } from '@/types'
import { parseSmartleadCampaignListJson } from '@/lib/smartlead-campaign-list'

const SMARTLEAD_API_BASE = 'https://server.smartlead.ai/api/v1'

function smartleadApiKey(): string {
  let k = (process.env.SMARTLEAD_API_KEY || '').trim()
  if ((k.startsWith('"') && k.endsWith('"')) || (k.startsWith("'") && k.endsWith("'"))) {
    k = k.slice(1, -1).trim()
  }
  return k
}

async function smartleadFetch(endpoint: string, options: RequestInit = {}) {
  const apiKey = smartleadApiKey()
  if (!apiKey) {
    throw new Error('SMARTLEAD_API_KEY is missing in .env.local')
  }
  const separator = endpoint.includes('?') ? '&' : '?'
  const url = `${SMARTLEAD_API_BASE}${endpoint}${separator}api_key=${encodeURIComponent(apiKey)}`

  const response = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
  })

  const text = await response.text()
  if (!response.ok) {
    throw new Error(`Smartlead API error: ${response.status} - ${text.slice(0, 800)}`)
  }
  const trimmed = text.trim()
  if (!trimmed) {
    return null
  }
  try {
    return JSON.parse(trimmed) as unknown
  } catch {
    throw new Error(`Smartlead API returned non-JSON (${response.status})`)
  }
}

function campaignsEndpointPath(): string {
  const clientId = (process.env.SMARTLEAD_CLIENT_ID || '').trim()
  if (!clientId) return '/campaigns/'
  return `/campaigns/?client_id=${encodeURIComponent(clientId)}`
}

// Campaigns — optional SMARTLEAD_CLIENT_ID for agency / multi-client keys (see Smartlead API).
export async function getCampaigns(): Promise<SmartleadCampaign[]> {
  const data = await smartleadFetch(campaignsEndpointPath())
  if (data && typeof data === 'object' && !Array.isArray(data)) {
    const err = (data as { error?: unknown }).error
    if (err != null && err !== '') {
      throw new Error(typeof err === 'string' ? err : JSON.stringify(err))
    }
  }
  return parseSmartleadCampaignListJson(data)
}

export async function getCampaign(campaignId: number): Promise<SmartleadCampaign> {
  const data = await smartleadFetch(`/campaigns/${campaignId}`)
  if (!data || typeof data !== 'object') {
    throw new Error('Smartlead returned an empty campaign response')
  }
  return data as SmartleadCampaign
}

export async function getCampaignSequences(campaignId: number): Promise<SmartleadSequence[]> {
  const data = await smartleadFetch(`/campaigns/${campaignId}/sequences`)
  return Array.isArray(data) ? (data as SmartleadSequence[]) : []
}

// Email Accounts
export async function getEmailAccounts(): Promise<SmartleadEmailAccount[]> {
  const data = await smartleadFetch('/email-accounts/')
  return Array.isArray(data) ? data : []
}

export async function getCampaignEmailAccounts(campaignId: number): Promise<SmartleadEmailAccount[]> {
  const data = await smartleadFetch(`/campaigns/${campaignId}/email-accounts`)
  return Array.isArray(data) ? data : []
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

// Lead Management — Smartlead only allows specific top-level keys; everything else goes in custom_fields.
// See https://api.smartlead.ai/api-reference/campaigns/add-leads
export interface LeadData {
  email: string
  first_name?: string
  last_name?: string
  company_name?: string
  custom_fields?: Record<string, string>
}

/**
 * Add one lead to a campaign. Does not set sender inboxes here — Smartlead rejects
 * `settings.email_account_ids` on this endpoint. Call `addEmailAccountsToCampaign` first
 * so the campaign is linked to the mailboxes you want.
 */
export type AddLeadsApiResponse = {
  success?: boolean
  added_count?: number
  skipped_count?: number
  skipped_leads?: unknown[]
  lead_ids?: number[]
  message?: string
  [key: string]: unknown
}

export async function addLeadToCampaign(
  campaignId: number,
  lead: LeadData
): Promise<AddLeadsApiResponse> {
  const data = await smartleadFetch(`/campaigns/${campaignId}/leads`, {
    method: 'POST',
    body: JSON.stringify({
      lead_list: [lead],
      settings: { return_lead_ids: true },
    }),
  })
  return (data ?? {}) as AddLeadsApiResponse
}

/** Escape text nodes for HTML email bodies. */
function escapeHtmlText(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

/**
 * Plain text → compact Smartlead HTML: one `<br>` between paragraphs; signature lines use `<br>` only (tight block).
 */
export function emailPlainTextToSmartleadHtml(introPlain: string, signaturePlain?: string): string {
  const intro = introPlain.trimEnd()
  const blocks = intro.split(/\n\s*\n+/).map((p) => p.trim()).filter(Boolean)
  const introHtml = blocks
    .map((p) => `<div>${escapeHtmlText(p).replace(/\n/g, '<br>')}</div>`)
    .join('<br>')

  let out = introHtml
  const sig = signaturePlain?.trim()
  if (sig) {
    const lines = sig.split('\n').map((l) => l.trim()).filter(Boolean)
    out += `<br><div>${lines.map(escapeHtmlText).join('<br>')}</div>`
  }

  return formatSmartleadHtml(out)
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
