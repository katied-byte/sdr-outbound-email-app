import OpenAI from 'openai'
import { HubSpotContact, HubSpotCompany, GeneratedEmail } from '@/types'
import { emailStyleConfig, getEmailSignature } from '@/config/email-style'
import {
  arketaOutboundLanguageAvoid,
  competitorPositioning,
  formatBattleCardForPrompt,
} from '@/config/competitor-positioning'
import { buildFirstEmailPersonalizedIntro } from '@/config/first-email-body'
import { enrichLeadFromGoogle } from '@/lib/google-lead-enrichment'
import { greetingFirstToken, resolveBookingSoftwareForContact } from '@/lib/booking-software'

function getOpenAIClient(): OpenAI {
  const key = process.env.OPENAI_API_KEY?.trim()
  if (!key) {
    throw new Error('OPENAI_API_KEY is missing')
  }
  return new OpenAI({ apiKey: key })
}

const OPENAI_MODEL = () => process.env.OPENAI_MODEL?.trim() || 'gpt-4o-mini'

const STRICT_RULES_SYSTEM =
  'You follow every MUST, NEVER, and FORBIDDEN rule in the user message exactly. Do not use forbidden phrases or close synonyms. Output only what is requested, with no preamble or quotes.'

async function completeText(
  prompt: string,
  options?: { max_tokens?: number; temperature?: number; system?: string }
): Promise<string> {
  const client = getOpenAIClient()
  const messages: OpenAI.Chat.ChatCompletionMessageParam[] = []
  if (options?.system) {
    messages.push({ role: 'system', content: options.system })
  }
  messages.push({ role: 'user', content: prompt })
  const res = await client.chat.completions.create({
    model: OPENAI_MODEL(),
    messages,
    temperature: options?.temperature ?? 0.75,
    max_tokens: options?.max_tokens ?? 512,
  })
  const text = res.choices[0]?.message?.content?.trim()
  if (!text) {
    throw new Error('OpenAI returned empty content')
  }
  return text
}

/**
 * SDR follow-up body: greeting, blank line, then short paragraphs (opener, pain, value, CTA).
 * Repairs model output that runs everything together on one line.
 */
function ensureEmailParagraphSpacing(body: string): string {
  let t = body.replace(/\r\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim()
  const blocks = t.split(/\n\s*\n/).map((b) => b.trim()).filter(Boolean)
  if (blocks.length >= 4 && /^Hi\s/i.test(blocks[0] ?? '')) {
    return blocks.join('\n\n')
  }

  const hiM = t.match(/^(Hi\s+[^,\n]+,|Hi\s+there,)\s*/i)
  if (!hiM) return t
  const greeting = hiM[1].trim()
  let rest = t.slice(hiM[0].length).replace(/^\s+/, '').replace(/^\n+/, '')

  const out: string[] = [greeting]

  const splitBeforeArketa = rest.split(/\.\s+(?=Arketa\b)/i)
  if (splitBeforeArketa.length === 2) {
    out.push(splitBeforeArketa[0].trim() + '.')
    rest = splitBeforeArketa[1].trim()
  } else {
    out.push(rest)
    return out.join('\n\n')
  }

  const ctaSplit = rest.split(
    /\.\s+(?=(?:Worth|Open|Could|Would|Interested|Care|Quick|Mind if|Make sense|Zoom|Book|Grab)\b)/i
  )
  if (ctaSplit.length === 2) {
    out.push(ctaSplit[0].trim() + '.')
    out.push(ctaSplit[1].trim())
  } else {
    const q = rest.lastIndexOf('?')
    if (q > 0) {
      const before = rest.slice(0, q)
      const dot = before.lastIndexOf('.')
      if (dot > 0) {
        out.push(rest.slice(0, dot + 1).trim())
        out.push(rest.slice(dot + 1).trim())
      } else {
        out.push(rest.trim())
      }
    } else {
      out.push(rest.trim())
    }
  }

  return out.join('\n\n')
}

/**
 * Model sometimes drops the vendor after "using/on/with", producing "studios using often".
 * Insert the known CRM stack label when we see those broken patterns.
 */
function repairDroppedCompetitorName(body: string, vendorLabel: string | null | undefined): string {
  const v = vendorLabel?.trim()
  if (!v) return body
  let t = body
  const afterUsing = String.raw`(?=often\b|face\b|find\b|struggle\b|see\b|deal\b|grapple\b|hit\b|run\b|get\b)`
  t = t.replace(/\busing\s+often\b/gi, `using ${v} often`)
  t = t.replace(/\bon\s+often\b/gi, `on ${v} often`)
  t = t.replace(/\bwith\s+often\b/gi, `with ${v} often`)
  t = t.replace(
    new RegExp(`(\\b(?:many\\s+)?(?:studios|teams|boutiques)\\s+)using\\s+${afterUsing}`, 'gi'),
    (_, p1: string) => `${p1}using ${v} `
  )
  t = t.replace(
    new RegExp(`(\\b(?:many\\s+)?(?:studios|teams|boutiques)\\s+)on\\s+${afterUsing}`, 'gi'),
    (_, p1: string) => `${p1}on ${v} `
  )
  return t
}

function normalizeBodyOutput(raw: string, competitorLabel?: string | null): string {
  let t = raw.trim()
  if (t.startsWith('```')) {
    t = t.replace(/^```[a-zA-Z]*\n?/, '').replace(/\n?```\s*$/, '').trim()
  }
  t = t.replace(/\u2014/g, '-').replace(/\u2013/g, '-')
  t = t.replace(/https?:\/\/[^\s]+/gi, '')
  t = t.replace(/\r\n/g, '\n')
  t = t
    .split('\n')
    .map((line) => line.replace(/[ \t]+/g, ' ').replace(/\s+([.,!?])/g, '$1').trim())
    .join('\n')
  t = t.replace(/\boperators\b/gi, 'studios')
  if (competitorLabel?.trim()) {
    t = repairDroppedCompetitorName(t, competitorLabel)
  }
  t = ensureEmailParagraphSpacing(t)
  return t.trim()
}

function usableFirstName(contact: HubSpotContact): string | null {
  return greetingFirstToken(contact.properties.firstname)
}

/** Parsed CRM call timestamp; null if missing or invalid. */
function parseCallDateMs(callDate: string | null | undefined): number | null {
  if (!callDate?.trim()) return null
  const t = new Date(callDate).getTime()
  if (Number.isNaN(t)) return null
  if (new Date(callDate).getFullYear() < 1972) return null
  return t
}

/**
 * True = call was more recent than two calendar months before today (strictly inside the last ~2 months).
 * False = call is older than that cutoff.
 */
function lastCallWithinLastTwoMonths(callDate: string | null | undefined): boolean | null {
  const callMs = parseCallDateMs(callDate)
  if (callMs === null) return null
  const cutoff = new Date()
  cutoff.setMonth(cutoff.getMonth() - 2)
  return callMs >= cutoff.getTime()
}

function touchBaseOpenerInstructionForLeadData(callDate: string | null | undefined): string {
  const within = lastCallWithinLastTwoMonths(callDate)
  if (within === null) {
    return 'Call date missing or not parsed — first sentence after greeting: **only** "I wanted to touch base again." (no month, no "since our last chat"). Then continue with the Studios using [platform] often feel… scaffold when platform is known.'
  }
  if (within) {
    return 'Last call was **less than 2 months ago** — first sentence after greeting must be **exactly** "I wanted to touch base again." **Do not** add "since our last chat in [Month]" or any date. Then continue (same or next sentence) with Studios using [platform] often feel… when platform is known.'
  }
  return 'Last call was **2 or more months ago** — first sentence must start with "I wanted to touch base again since our last chat in [Month]." [Month] = English month name from CRM. Then continue with Studios using [platform] often feel… when platform is known.'
}

function resolveBookingSoftwareForLead(context: LeadContext): string | null {
  const contact = context.contact
  const merged: HubSpotContact = {
    ...contact,
    company: contact.company ?? context.company ?? undefined,
  }
  return resolveBookingSoftwareForContact(merged)
}

/** Structured call + CRM payload for STEP 1 extraction in the SDR follow-up prompt. */
function formatLeadBlock(context: LeadContext, googleContext?: string): string {
  const { contact, company } = context
  const p = contact.properties
  const c = company?.properties
  const bookingSw = resolveBookingSoftwareForLead(context)
  const contactFullName = [p.firstname, p.lastname].filter(Boolean).join(' ').trim() || 'N/A'

  const lines: string[] = ['--- STEP 1: EXTRACT FROM THIS DATA ---']

  const call = contact.lastCall
  if (call) {
    const when =
      call.date &&
      !Number.isNaN(new Date(call.date).getTime()) &&
      new Date(call.date).getFullYear() > 1971
        ? new Date(call.date).toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'long',
            day: 'numeric',
          })
        : 'Unknown / not parsed'
    lines.push(
      'PAST CALL (CRM — prioritize for opener + challenges):',
      `- When we last spoke (from CRM): ${when}`,
      `- Disposition / outcome (if any): ${call.disposition?.replace(/_/g, ' ') ?? 'N/A'}`,
      `- Who we spoke with (default: this contact unless notes say otherwise): ${contactFullName} (${p.jobtitle?.trim() || 'role unknown'})`,
      `- Call notes (verbatim — extract challenges, interest level, software mentions here first):\n${call.notes?.trim() || '(none)'}`,
      `- **TOUCH-BASE OPENER (computed — follow exactly):** ${touchBaseOpenerInstructionForLeadData(call.date)}`,
      ''
    )
  } else {
    lines.push(
      'PAST CALL (CRM): No call record attached to this payload.',
      '- Do **not** invent a conversation, date, or transcript. Skip call-specific opener; use CRM + competitive insights (STEP 2B).',
      ''
    )
  }

  lines.push(
    'CONTACT & COMPANY:',
    `Company name: ${c?.name ?? 'N/A'}`,
    `Contact name: ${contactFullName}`,
    `Role: ${p.jobtitle ?? 'N/A'}`,
    `Email: ${p.email ?? 'N/A'}`,
    `Current software (CRM / notes / timeline — use for STEP 2; do not guess if below says not found): ${bookingSw ?? 'NOT FOUND — do not invent a vendor name.'}`
  )

  if (c) {
    const rating = c.gmaps_ratings?.trim()
    lines.push(
      `Website domain: ${c.domain ?? 'N/A'}`,
      `City / state: ${[c.city, c.state].filter(Boolean).join(', ') || 'N/A'}`,
      `GMaps rating (if numeric, optional color only — do not invent): ${rating || 'N/A'}`,
      `Google review count: ${c.gmaps_reviews ?? 'N/A'}`,
      `Locations / class volume / modalities (context only): ${c.promptloop_number_of_locations ?? 'N/A'} loc · ${c.promptloop_avg_daily_class_count ?? 'N/A'} avg classes · ${c.promptloop_modalities ?? c.gtm_modality ?? 'N/A'}`
    )
  }

  if (context.campaignContext?.trim()) {
    lines.push(`Campaign context: ${context.campaignContext.trim()}`)
  }

  const g = googleContext?.trim()
  if (g) {
    lines.push(
      '',
      'GOOGLE / PUBLIC (optional — use only if clearly this business; may be wrong):',
      g
    )
  }

  if (contact.hubspotCrmNotesText?.trim()) {
    lines.push(
      '',
      'ADDITIONAL CRM NOTE TEXT (timeline/other — secondary to call notes):',
      contact.hubspotCrmNotesText.trim()
    )
  }

  return lines.join('\n')
}

function formatArketaAvoidListForPrompt(): string {
  return arketaOutboundLanguageAvoid.join(', ')
}

/** STEP 2B/C: inferred pains + Arketa pillars — only when call notes are thin; never override explicit call challenges. */
function buildCompetitiveInsightsBlock(context: LeadContext): string {
  const raw = resolveBookingSoftwareForLead(context)
  const valueMenu = competitorPositioning.arketaGeneral
    .slice(0, 8)
    .map((line, i) => `${i + 1}. ${line}`)
    .join('\n')

  if (!raw) {
    return `CURRENT SOFTWARE: Not confirmed in CRM for this lead.
Use STEP 2B with **general** boutique scheduling / client-experience / ops friction only if call notes lack specifics — do **not** name a competitor platform you cannot support from LEAD DATA.

ARKETA VALUE PILLARS (pick 1–2 that fit the pains you chose; rephrase in conversation — do not quote):
${valueMenu}

Do not mention price, dollars, percentages, or contract terms.`
  }

  const key = competitorPositioning.normalizeBookingSoftware(raw)
  const battleBlock = key ? `\n${formatBattleCardForPrompt(key, raw)}\n` : ''
  const unknown =
    key == null
      ? `\nNo full battle card for "${raw}" — infer **specific**, plausible operational frictions for that stack; stay qualitative.\n`
      : ''

  return `CURRENT SOFTWARE (CRM): ${raw} — use for STEP 2B/C when call notes do not name challenges.${unknown}${battleBlock}
ARKETA VALUE PILLARS (map to the pains you chose; rephrase; do not quote verbatim):
${valueMenu}

Do not mention price, dollars, percentages, or contract terms. Never paste URLs.`
}

function buildSdrFollowUpBodyPrompt(
  context: LeadContext,
  feedback?: string,
  googleContext?: string
): string {
  const fn = usableFirstName(context.contact)
  const greetingRule = fn
    ? `Line 1 must be ONLY: "Hi ${fn}," (capital Hi, comma). No other words on line 1.`
    : `Line 1 must be ONLY: "Hi there," if no usable first name in LEAD DATA.`

  const feedbackBlock = feedback?.trim()
    ? `\n\nUSER FEEDBACK (revise the email accordingly; keep all rules):\n${feedback.trim()}\n`
    : ''

  return `You are an SDR writing a highly personalized follow-up email based on past call notes when available.

Your goal is to prioritize REAL conversation data. If data is missing, intelligently fill gaps using competitive insights below.

------------------------
STEP 1: DATA EXTRACTION
------------------------

First, analyze LEAD DATA below and extract (mentally — do not output this list):
- Company name
- Contact name + role
- When we last spoke (month/timeframe) — only if PAST CALL block has a real date
- Who we last spoke with (default: contact named in CRM unless notes say otherwise)
- Current software they are using (from CRM line — do not invent)
- Specific challenges mentioned in call notes (if any)
- Any stated level of interest

------------------------
STEP 2: CONDITIONAL LOGIC
------------------------

A. IF past call notes include specific challenges:
- Use ONLY the challenges explicitly mentioned
- Expand those into clear business impact (time loss, inefficiency, revenue leakage, poor client experience, etc.)

B. IF NO clear challenges are mentioned in notes:
- Identify the software from LEAD DATA when provided
- Infer 1–2 highly relevant, specific pain points associated with that platform (use COMPETITIVE INSIGHTS below)
- Tie those to clear business impact
- If software is unknown, use general boutique ops pain without naming a fake vendor

C. IF both exist:
- Prioritize real call insights first
- Lightly reinforce with one inferred insight if it strengthens the message (do not contradict the call)

------------------------
STEP 3: EMAIL OUTPUT
------------------------

Write a concise follow-up email with this structure (plain text):

1. Personalized opener (after greeting + blank line):
- **If PAST CALL exists in LEAD DATA:** Follow the line **TOUCH-BASE OPENER (computed — follow exactly)** in LEAD DATA. That rule chooses either (a) **only** \`I wanted to touch base again.\` when the last call was **less than 2 months ago**, or (b) \`I wanted to touch base again since our last chat in [Month].\` when the last call was **2+ months ago** (English month from CRM — no typos like "Match").
- **Right after** that touch-base sentence, in the **same sentence or the very next sentence**, continue with: \`Studios using [platform] often feel\` … and a **specific** pain (call notes first, else COMPETITIVE INSIGHTS). [platform] = **exact** CURRENT SOFTWARE from LEAD DATA when known; if unknown, **omit** that clause and open pain honestly (no invented vendor).
- **If there is NO past call in LEAD DATA:** Do **not** claim a dated chat. Use a short honest opener; follow STEP 2B; stay under 75 words.

2. Pain + impact:
- Use real challenges OR inferred ones (per STEP 2)
- Clearly connect to business impact

3. Value positioning:
- Position Arketa as solving those specific issues
- Tailored, not generic; conversational

4. Call to action:
- Low-friction ask
- **Must** propose a **quick Zoom** where you walk them through **their use case in the Arketa dashboard** (or equivalent wording — be specific about dashboard + Zoom)

Formatting:
- After line 1 (greeting), use a blank line, then short paragraphs separated by blank lines for beats 1–4 (still plain text).
- **Under 75 words** for the entire email including the greeting line (hard cap — count every word). Be ruthless: tight sentences; you may merge opener + pain or value + CTA into fewer paragraphs if needed; keep the Zoom + dashboard CTA to **one** short sentence.
- Natural, conversational; no buzzwords or fluff; not a stiff template
- Do NOT use the word "operators"
- No em dashes (use commas, periods, or hyphen)
- When listing pairs, use "and" or "+" (not "&")
- Do not mention Arketa pricing, cost, or fees
- Do not put URLs or https:// links in the body
- Do **not** invent revenue stats, growth multiples, dollar amounts, or named customer proof unless explicitly in LEAD DATA
- Do not open by reciting their class menu or modalities from CRM
- Output ONLY the final email body (no subject line, no signature, no preamble, no bullets labeled STEP 1/2/3)
- **First-person "I"** in the opener is required when using the touch-base pattern (the rep is writing).

FORBIDDEN PHRASES (do not use or echo closely): ${formatArketaAvoidListForPrompt()}

${greetingRule}

LEAD DATA:
${formatLeadBlock(context, googleContext)}

------------------------
COMPETITIVE INSIGHTS (for STEP 2B/C — gap-fill only; never override explicit call challenges)
------------------------
${buildCompetitiveInsightsBlock(context)}
${feedbackBlock}`
}

/** Subject generation: omit first name so the model is not primed to echo it in the subject. */
function leadContextForSubjectLine(contact: HubSpotContact, company: HubSpotCompany | null): string {
  const role = contact.properties.jobtitle?.trim() || ''
  const co = company?.properties?.name?.trim() || ''
  return [co, role].filter(Boolean).join(' · ') || 'Fitness/wellness prospect'
}

function buildSubjectPrompt(personalizedIntro: string, oneLiner: string): string {
  const subjectRules = emailStyleConfig.subjectLineRules
  const subjectRulesBlock = subjectRules?.length
    ? `\nAdditional subject rules:\n${subjectRules.map((r) => `- ${r}`).join('\n')}\n`
    : ''
  const tone = emailStyleConfig.tone
  return `The email body below is an SDR **follow-up** to a wellness / fitness studio prospect (it may reference a past call when CRM included call data). Write **one** subject line that fits this follow-up.

Tone: ${tone}
${subjectRulesBlock}
Prospect context (never put their personal name in the subject): ${oneLiner}

Email body:
${personalizedIntro}

CRITICAL:
- Do NOT use the prospect's first or last name in the subject.
- Follow-up-friendly patterns are OK (e.g. quick follow-up, circling back, thoughts on our chat) as long as they match the body and stay under 55 characters.
- Do not name a specific booking vendor (Mindbody, Glofox, etc.) unless unavoidable; generic "platform" / "setup" wording is safer.

Output ONLY the subject line, nothing else. Max 55 characters. No quotation marks around it.`
}

export interface LeadContext {
  contact: HubSpotContact
  company: HubSpotCompany | null
  campaignContext?: string
  senderFirstName?: string
  senderLastName?: string
}

export async function generatePersonalizedEmail(
  context: LeadContext
): Promise<GeneratedEmail> {
  const { contact } = context
  const c = context.company?.properties
  const googleContext = await enrichLeadFromGoogle({
    companyName: c?.name,
    city: c?.city,
    state: c?.state,
    domain: c?.domain,
  })
  let personalizedIntro: string
  try {
    const stackLabel = resolveBookingSoftwareForLead(context)
    personalizedIntro = normalizeBodyOutput(
      await completeText(buildSdrFollowUpBodyPrompt(context, undefined, googleContext), {
        max_tokens: 220,
        temperature: 0.65,
        system: STRICT_RULES_SYSTEM,
      }),
      stackLabel
    )
  } catch (e) {
    console.error('[openai-email] Body generation failed, using static template:', e)
    personalizedIntro = buildFirstEmailPersonalizedIntro(contact.properties.firstname)
  }

  const subject = await completeText(
    buildSubjectPrompt(personalizedIntro, leadContextForSubjectLine(contact, context.company)),
    { max_tokens: 80, temperature: 0.45, system: STRICT_RULES_SYSTEM }
  )

  return {
    subject,
    personalizedIntro,
    fullBody: buildFullEmailBody(
      personalizedIntro,
      context.senderFirstName,
      context.senderLastName
    ),
  }
}

function buildFullEmailBody(
  personalizedIntro: string,
  senderFirstName?: string,
  senderLastName?: string
): string {
  const signature = getEmailSignature(senderFirstName || '', senderLastName || '')
  return `${personalizedIntro}\n\n${signature}`
}

export async function regenerateEmail(
  context: LeadContext,
  feedback?: string
): Promise<GeneratedEmail> {
  const { contact } = context
  const c = context.company?.properties
  const googleContext = await enrichLeadFromGoogle({
    companyName: c?.name,
    city: c?.city,
    state: c?.state,
    domain: c?.domain,
  })
  let personalizedIntro: string
  try {
    const stackLabel = resolveBookingSoftwareForLead(context)
    personalizedIntro = normalizeBodyOutput(
      await completeText(buildSdrFollowUpBodyPrompt(context, feedback, googleContext), {
        max_tokens: 220,
        temperature: 0.65,
        system: STRICT_RULES_SYSTEM,
      }),
      stackLabel
    )
  } catch (e) {
    console.error('[openai-email] Regenerate body failed, using static template:', e)
    personalizedIntro = buildFirstEmailPersonalizedIntro(contact.properties.firstname)
  }

  const subject = await completeText(
    buildSubjectPrompt(personalizedIntro, leadContextForSubjectLine(contact, context.company)),
    { max_tokens: 80, temperature: 0.45, system: STRICT_RULES_SYSTEM }
  )

  return {
    subject,
    personalizedIntro,
    fullBody: buildFullEmailBody(
      personalizedIntro,
      context.senderFirstName,
      context.senderLastName
    ),
  }
}
