/**
 * HubSpot internal property names for "which booking software" (first non-empty wins).
 * Also parses common vendors from call notes when CRM fields are empty.
 */
import type { HubSpotContact } from '@/types'

const BOOKING_SOFTWARE_HUBSPOT_KEYS = [
  'promptloop_booking_software',
  'booking_software',
  'booking_platform',
] as const

/** Optional HubSpot internal names (company and/or contact) — comma-separated in env. */
export function extraBookingSoftwarePropertyKeys(): string[] {
  return (
    process.env.HUBSPOT_BOOKING_SOFTWARE_PROPERTY_KEYS?.split(',')
      .map((s) => s.trim())
      .filter(Boolean) ?? []
  )
}

export function allBookingSoftwarePropertyKeys(): string[] {
  return [...BOOKING_SOFTWARE_HUBSPOT_KEYS, ...extraBookingSoftwarePropertyKeys()]
}

/** HubSpot `domain` is usually host only, e.g. pilatesroomstudios.com */
export function normalizeStudioDomain(domain: string | null | undefined): string | null {
  if (!domain?.trim()) return null
  let s = domain.trim().toLowerCase()
  s = s.replace(/^https?:\/\//, '').replace(/^www\./, '')
  const slash = s.indexOf('/')
  if (slash !== -1) s = s.slice(0, slash)
  return s || null
}

/**
 * URLs that are the studio's own schedule page (or generic /allschedules paths) are NOT the stack.
 * Third-party vendor hosts (mindbodyonline.com, etc.) return false here so we can map them to a label.
 */
export function bookingValueLooksLikeOwnSiteOrScheduleLink(
  value: string,
  studioDomain?: string | null
): boolean {
  const t = value.trim()
  if (!/https?:\/\//i.test(t)) return false
  try {
    const m = t.match(/https?:\/\/[^\s<>"']+/i)
    const toParse = m ? m[0] : t
    const u = new URL(toParse.startsWith('http') ? toParse : `https://${toParse}`)
    const host = u.hostname.replace(/^www\./i, '').toLowerCase()
    if (vendorLabelFromHostname(host)) return false

    const sd = normalizeStudioDomain(studioDomain)
    if (sd && (host === sd || host.endsWith(`.${sd}`))) return true

    const p = (u.pathname + u.search).toLowerCase()
    if (
      /\/(all)?schedules?|\/schedule\/|\/book(ing)?\/|\/classes\/|\/calendar|widget|embed|\/reserve|\/appointments?/i.test(
        p
      )
    ) {
      return true
    }
    return false
  } catch {
    return false
  }
}

function isUsableStackCandidateValue(value: string, studioDomain?: string | null): boolean {
  const v = value.trim()
  if (!v) return false
  if (bookingValueLooksLikeOwnSiteOrScheduleLink(v, studioDomain)) return false
  return true
}

export function pickBookingSoftware(
  props: Record<string, string | null | undefined> | null | undefined,
  studioDomain?: string | null
): string | null {
  if (!props) return null
  for (const k of allBookingSoftwarePropertyKeys()) {
    const v = props[k]
    if (typeof v !== 'string' || !v.trim()) continue
    const t = v.trim()
    if (!isUsableStackCandidateValue(t, studioDomain)) continue
    return t
  }
  return null
}

/** Skip numeric / operational fields that contain "booking" but are not the stack (e.g. staff on booking page). */
const BOOKING_SOFTWARE_KEY_SKIP =
  /modalit|modality|gmaps|review|rating|staff_count|_count|_avg|number_of_location|employee|revenue|annual|description|about|phone|address|zip|domain|city|state|country|facebook|linkedin|twitter|website|hs_|hubspot|createdate|lastmodified|^name$/i

/** Heuristic match on internal property names when label differs (e.g. custom Promptloop export names). */
const BOOKING_SOFTWARE_KEY_HINT =
  /booking.*(software|platform|system|tool|stack)|promptloop.*(book|competit|stack|plat|soft|vendor)|\bcompetit|schedul.*(software|platform|system)|studio.*(software|platform|stack|mgmt|management)|tech_stack|vendor|current_.*tool|point_of_sale|\bpos_/i

/** Keys that are almost always embed/schedule links, not vendor name — skip even if value slips through. */
const BOOKING_SOFTWARE_KEY_URL_JUNK =
  /_url$|_link$|schedule_page|scheduling_link|booking_page_url|class_link|embed|widget|iframe/i

/**
 * Known keys first, then any other populated property whose name looks like booking/stack/competitor.
 */
export function pickBookingSoftwareDeep(
  props: Record<string, string | null | undefined> | null | undefined,
  studioDomain?: string | null
): string | null {
  const direct = pickBookingSoftware(props, studioDomain)
  if (direct) return direct
  if (!props) return null
  const candidates: { k: string; v: string; rank: number }[] = []
  for (const [k, v] of Object.entries(props)) {
    if (typeof v !== 'string' || !v.trim()) continue
    if (BOOKING_SOFTWARE_KEY_SKIP.test(k)) continue
    if (BOOKING_SOFTWARE_KEY_URL_JUNK.test(k)) continue
    if (!BOOKING_SOFTWARE_KEY_HINT.test(k)) continue
    const t = v.trim()
    if (!isUsableStackCandidateValue(t, studioDomain)) continue
    let rank = 2
    if (/promptloop/i.test(k)) rank = 0
    else if (/booking_software|booking_platform|competit/i.test(k)) rank = 1
    candidates.push({ k, v: t, rank })
  }
  if (candidates.length === 0) return null
  candidates.sort((a, b) => a.rank - b.rank || a.k.localeCompare(b.k))
  return candidates[0]!.v
}

/** First whitespace-delimited token — HubSpot often stores full name in `firstname`. */
export function greetingFirstToken(firstname: string | null | undefined): string | null {
  const raw = firstname?.trim() ?? ''
  if (!raw || /^unknown$/i.test(raw)) return null
  const first = raw.split(/\s+/)[0]
  return first || null
}

/**
 * Ordered patterns (more specific first). Labels are normalized for display + prompts.
 */
const VENDOR_NOTE_PATTERNS: Array<{ label: string; patterns: RegExp[] }> = [
  { label: 'WellnessLiving', patterns: [/\bwellness\s*living\b/i] },
  { label: 'Mariana Tek', patterns: [/\bmariana\s*tek\b/i] },
  { label: 'Mindbody', patterns: [/\bmindbody\b/i, /\bmindbodyonline\b/i, /\bmbode\b/i, /\bheymuvo\b/i] },
  { label: 'Momence', patterns: [/\bmomence\b/i] },
  { label: 'Walla', patterns: [/\bwalla\b/i, /\bgetwalla\b/i] },
  { label: 'Glofox', patterns: [/\bglofox\b/i] },
  { label: 'ClubReady', patterns: [/\bclub\s*ready\b/i, /\bclubready\b/i] },
  { label: 'Pike13', patterns: [/\bpike\s*13\b/i, /\bpike13\b/i] },
  { label: 'Zen Planner', patterns: [/\bzen\s*planner\b/i, /\bzenplanner\b/i] },
  { label: 'Acuity Scheduling', patterns: [/\bacuity\s*scheduling\b/i, /\bacuity\b/i] },
  { label: 'Vagaro', patterns: [/\bvagaro\b/i] },
  { label: 'Booksy', patterns: [/\bbooksy\b/i] },
  { label: 'TeamUp', patterns: [/\bteamup\b/i] },
  { label: 'Triib', patterns: [/\btriib\b/i] },
  { label: 'PushPress', patterns: [/\bpush\s*press\b/i, /\bpushpress\b/i] },
  { label: 'BSport', patterns: [/\bbsport\b/i] },
  { label: 'FitDegree', patterns: [/\bfitdegree\b/i] },
  { label: 'TrueCoach', patterns: [/\btrue\s*coach\b/i, /\btruecoach\b/i] },
  { label: 'Exercise.com', patterns: [/\bexercise\.com\b/i] },
]

/** Map booking-page hostnames (and common variants) to a clean vendor label for prompts and email copy. */
function vendorLabelFromHostname(host: string): string | null {
  const h = host.toLowerCase().replace(/^www\./, '')
  if (h.includes('momence')) return 'Momence'
  if (h.includes('mindbodyonline') || h === 'mindbody.com' || h.endsWith('.mindbodyonline.com')) return 'Mindbody'
  if (h.includes('wellnessliving')) return 'WellnessLiving'
  if (h.includes('marianatek') || h.includes('mariana-tek')) return 'Mariana Tek'
  if (h.includes('getwalla') || h.includes('walla.com') || h.includes('.walla.')) return 'Walla'
  if (h.includes('glofox')) return 'Glofox'
  if (h.includes('acuityscheduling') || h === 'acuity.com') return 'Acuity Scheduling'
  if (h.includes('vagaro')) return 'Vagaro'
  if (h.includes('booksy')) return 'Booksy'
  if (h.includes('teamup')) return 'TeamUp'
  if (h.includes('pushpress')) return 'PushPress'
  if (h.includes('bsport')) return 'BSport'
  if (h.includes('fitdegree')) return 'FitDegree'
  if (h.includes('clubready') || h.includes('club-ready')) return 'ClubReady'
  if (h.includes('zenplanner') || h.includes('zen-planner')) return 'Zen Planner'
  if (h.includes('pike13') || h.includes('pike-13')) return 'Pike13'
  if (h.includes('triib')) return 'Triib'
  if (h.includes('truecoach')) return 'TrueCoach'
  if (h.includes('exercise.com')) return 'Exercise.com'
  return null
}

/**
 * CRM fields sometimes store a vendor booking URL instead of a name. Never pass raw URLs to email copy.
 */
export function normalizeBookingSoftwareValue(
  raw: string | null | undefined,
  studioDomain?: string | null
): string | null {
  if (!raw || typeof raw !== 'string') return null
  const t = raw.trim()
  if (!t) return null

  if (bookingValueLooksLikeOwnSiteOrScheduleLink(t, studioDomain)) return null

  const urlMatch = t.match(/https?:\/\/[^\s<>"']+/i)
  const candidateUrl = urlMatch ? urlMatch[0] : null
  if (candidateUrl || /^(https?:)?\/\//i.test(t) || /^www\.[^.]+\./i.test(t)) {
    const toParse = candidateUrl || (t.startsWith('http') ? t : `https://${t.replace(/^\/\//, '')}`)
    try {
      const u = new URL(toParse)
      const label = vendorLabelFromHostname(u.hostname)
      if (label) return label
      const path = `${u.pathname} ${u.hostname}`.toLowerCase()
      if (path.includes('momence')) return 'Momence'
      if (path.includes('mindbody')) return 'Mindbody'
    } catch {
      const m = t.match(/https?:\/\/(?:www\.)?([^\/\s#?]+)/i)
      if (m) {
        const label = vendorLabelFromHostname(m[1])
        if (label) return label
      }
    }
  }

  const fromText = extractBookingSoftwareFromCallNotes(t)
  if (fromText) return fromText

  // Short single-line CRM labels only (not sentences from call notes).
  if (/[\n\r]/.test(t) || t.length > 64) return null
  return t
}

/**
 * Best-effort parse of booking / scheduling vendor names from free text (call logs, CRM notes).
 * Returns null if nothing matches.
 */
export function extractBookingSoftwareFromCallNotes(text: string | null | undefined): string | null {
  if (!text || typeof text !== 'string') return null
  const t = text.trim()
  if (t.length < 4) return null
  if (/^\[NOOKS\]\s*-\s*$/i.test(t)) return null

  for (const { label, patterns } of VENDOR_NOTE_PATTERNS) {
    for (const re of patterns) {
      if (re.test(t)) return label
    }
  }
  return null
}

/**
 * CRM company + contact properties first, then call notes + CRM timeline notes (reps often log stack in Notes).
 * Values that are URLs are normalized to vendor names (e.g. momence.com/... → Momence).
 */
function resolveNormalizedStackLabel(
  raw: string,
  studioDomain: string | null | undefined
): string | null {
  const n = normalizeBookingSoftwareValue(raw, studioDomain)
  if (n) return n
  if (/https?:\/\//i.test(raw)) return null
  if (/[\n\r]/.test(raw) || raw.length > 64) return null
  return raw
}

export function resolveBookingSoftwareForContact(contact: HubSpotContact): string | null {
  const studioDomain = contact.company?.properties?.domain ?? null
  const fromCompany = pickBookingSoftwareDeep(
    contact.company?.properties as Record<string, string | null | undefined>,
    studioDomain
  )
  if (fromCompany) {
    return resolveNormalizedStackLabel(fromCompany, studioDomain)
  }
  const fromContact = pickBookingSoftwareDeep(
    contact.properties as Record<string, string | null | undefined>,
    studioDomain
  )
  if (fromContact) {
    return resolveNormalizedStackLabel(fromContact, studioDomain)
  }
  const combined = [contact.lastCall?.notes, contact.hubspotCrmNotesText]
    .filter((s): s is string => typeof s === 'string' && s.trim().length > 0)
    .join('\n\n')
  if (!combined.trim()) return null
  const fromPatterns = extractBookingSoftwareFromCallNotes(combined)
  if (fromPatterns) {
    return normalizeBookingSoftwareValue(fromPatterns, studioDomain) || fromPatterns
  }
  return normalizeBookingSoftwareValue(combined, studioDomain)
}
