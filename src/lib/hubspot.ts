import fs from 'fs'
import path from 'path'
import { loadEnvConfig } from '@next/env'
import { HubSpotContact, HubSpotCompany, HubSpotList, HubSpotCallNote } from '@/types'
import {
  extractBookingSoftwareFromCallNotes,
  extraBookingSoftwarePropertyKeys,
  normalizeBookingSoftwareValue,
  pickBookingSoftwareDeep,
} from '@/lib/booking-software'

const HUBSPOT_API_BASE = 'https://api.hubapi.com'

const HUBSPOT_ENV_KEYS = ['HUBSPOT_ACCESS_TOKEN', 'HUBSPOT_PRIVATE_APP_TOKEN'] as const

/** Re-merge .env.local into process.env (fixes rare cases where API routes see an empty token). */
let hubspotEnvMerged = false
function ensureHubSpotEnvFromFiles() {
  if (hubspotEnvMerged) return
  hubspotEnvMerged = true
  try {
    loadEnvConfig(process.cwd(), process.env.NODE_ENV === 'development', undefined, true)
  } catch {
    // ignore — fall back to existing process.env
  }
}

/**
 * Read a single KEY=value from dotenv-style file contents (no multiline values).
 * Handles optional quotes and trailing ` # comment` on the value line.
 */
function parseEnvValue(contents: string, key: string): string | undefined {
  for (let line of contents.split('\n')) {
    line = line.replace(/\r$/, '')
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const eq = trimmed.indexOf('=')
    if (eq === -1) continue
    const k = trimmed.slice(0, eq).trim()
    if (k !== key) continue
    let v = trimmed.slice(eq + 1).trim()
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
      v = v.slice(1, -1)
    } else {
      const hashAt = v.search(/\s+#/)
      if (hashAt !== -1) v = v.slice(0, hashAt).trim()
    }
    const out = v.trim()
    return out.length > 0 ? out : undefined
  }
  return undefined
}

/** Directories to check for env files (cwd + parents — monorepo / odd Next cwd). */
function candidateProjectRoots(): string[] {
  const dirs: string[] = []
  let cur = path.resolve(process.cwd())
  for (let i = 0; i < 6; i++) {
    dirs.push(cur)
    const parent = path.dirname(cur)
    if (parent === cur) break
    cur = parent
  }
  return dirs
}

/** When process.env is empty (Next quirk), read token straight from disk — local dev only usually. */
let diskTokenCache: string | null | undefined
function hubspotTokenFromDisk(): string {
  if (diskTokenCache !== undefined) return diskTokenCache ?? ''

  const files = ['.env.local', '.env.development.local', '.env']

  for (const root of candidateProjectRoots()) {
    for (const name of files) {
      const full = path.join(root, name)
      try {
        if (!fs.existsSync(full)) continue
        const raw = fs.readFileSync(full, 'utf8')
        for (const key of HUBSPOT_ENV_KEYS) {
          const v = parseEnvValue(raw, key)
          if (v) {
            diskTokenCache = v
            return v
          }
        }
      } catch {
        /* continue */
      }
    }
  }

  diskTokenCache = null
  return ''
}

function tIsPlaceholder(token: string): boolean {
  const p = token.toLowerCase()
  return p === 'your_hubspot_access_token' || p === 'your hubspot access token' || p.startsWith('your_')
}

function normalizeToken(t: string): string {
  let s = t.trim()
  if ((s.startsWith('"') && s.endsWith('"')) || (s.startsWith("'") && s.endsWith("'"))) {
    s = s.slice(1, -1).trim()
  }
  return s
}

/** Private app token (PAT) from HubSpot — not an OAuth client secret. */
export function hubspotAccessToken(): string {
  ensureHubSpotEnvFromFiles()
  // Bracket keys so Next never inlines a build-time empty string into this module.
  let t = normalizeToken(
    process.env['HUBSPOT_ACCESS_TOKEN'] || process.env['HUBSPOT_PRIVATE_APP_TOKEN'] || ''
  )

  if (!t) {
    t = normalizeToken(hubspotTokenFromDisk())
  }

  if (process.env.NODE_ENV === 'development' && !t) {
    console.warn(
      '[hubspot] No HUBSPOT_ACCESS_TOKEN from process.env or .env.local on disk. cwd=%s',
      process.cwd()
    )
  }

  return t
}

async function hubspotFetch(endpoint: string, options: RequestInit = {}) {
  const token = hubspotAccessToken()
  if (!token || tIsPlaceholder(token)) {
    throw new Error(
      'HUBSPOT_ACCESS_TOKEN is missing or still a placeholder. Create a HubSpot Private App token and paste it in .env.local — see docs/HUBSPOT-SETUP.md'
    )
  }

  const response = await fetch(`${HUBSPOT_API_BASE}${endpoint}`, {
    ...options,
    cache: 'no-store',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      ...options.headers,
    },
  })

  if (!response.ok) {
    const error = await response.text()
    throw new Error(`HubSpot API error: ${response.status} - ${error}`)
  }

  return response.json()
}

// Contact properties we want to fetch
const CONTACT_PROPERTIES = [
  'firstname',
  'lastname',
  'jobtitle',
  'email',
  'associatedcompanyid', // primary company; avoids broken association parsing
  'promptloop_booking_software',
  'booking_software',
  'booking_platform',
]

// Company properties we want to fetch (adjust internal names as needed)
const COMPANY_PROPERTIES = [
  'name',
  'domain',
  'city',
  'state',
  'gtm_modality',
  'promptloop_modalities',
  'promptloop_booking_software',
  'booking_software',
  'booking_platform',
  'promptloop_number_of_locations',
  'promptloop_avg_daily_class_count',
  'promptloop_staff_count_website',
  'promptloop_staff_count_booking_page',
  'gmaps_ratings',
  'gmaps_reviews',
]

function allContactProperties(): string[] {
  return Array.from(new Set([...CONTACT_PROPERTIES, ...extraBookingSoftwarePropertyKeys()]))
}

function allCompanyProperties(): string[] {
  return Array.from(new Set([...COMPANY_PROPERTIES, ...extraBookingSoftwarePropertyKeys()]))
}

const MAX_EXTRA_STACK_PROPS = 45

let extraCompanyStackPropNamesCache: string[] | undefined
let extraContactStackPropNamesCache: string[] | undefined

function isProbablyStackCrmProperty(name: string, label: string): boolean {
  const nl = name.toLowerCase()
  if (nl.startsWith('hs_')) return false
  const combined = `${name} ${label}`.toLowerCase()
  if (
    /modalit|modality|gmaps|geocode|review|rating|photo|employee|headcount|staff_count|revenue|annual|number_of_location|avg_daily|class_count|description|about|timezone|address|phone|postal|country|facebook|linkedin|twitter|website/.test(
      combined
    )
  ) {
    return false
  }
  if (
    /booking|promptloop|competit|schedul|vendor|tech\s*stack|studio\s*management|point\s*of\s*sale|\bpos\b|payment\s*processor|merchant/.test(
      combined
    )
  ) {
    return true
  }
  if (/promptloop/.test(nl) && /book|soft|plat|stack|competit|vendor|tool/.test(combined)) return true
  return false
}

async function fetchAllCrmPropertyDefinitions(
  objectType: 'companies' | 'contacts'
): Promise<Array<{ name: string; label?: string }>> {
  const out: Array<{ name: string; label?: string }> = []
  let after: string | undefined
  for (let page = 0; page < 40; page++) {
    const qs = new URLSearchParams()
    qs.set('limit', '100')
    if (after) qs.set('after', after)
    const data = (await hubspotFetch(`/crm/v3/properties/${objectType}?${qs}`)) as {
      results?: Array<{ name?: string; label?: string }>
      paging?: { next?: { after?: string } }
    }
    for (const r of data.results || []) {
      if (r?.name) out.push({ name: r.name, label: r.label })
    }
    after = data.paging?.next?.after
    if (!after) break
  }
  return out
}

async function getExtraStackPropertyNamesForObjectType(
  objectType: 'companies' | 'contacts'
): Promise<string[]> {
  const cache =
    objectType === 'companies' ? extraCompanyStackPropNamesCache : extraContactStackPropNamesCache
  if (cache) return cache
  try {
    const defs = await fetchAllCrmPropertyDefinitions(objectType)
    const names = new Set<string>()
    const base =
      objectType === 'companies' ? new Set(COMPANY_PROPERTIES) : new Set(CONTACT_PROPERTIES)
    for (const d of defs) {
      if (base.has(d.name)) continue
      if (isProbablyStackCrmProperty(d.name, d.label || '')) names.add(d.name)
    }
    const arr = Array.from(names).sort().slice(0, MAX_EXTRA_STACK_PROPS)
    if (objectType === 'companies') extraCompanyStackPropNamesCache = arr
    else extraContactStackPropNamesCache = arr
    return arr
  } catch {
    if (objectType === 'companies') extraCompanyStackPropNamesCache = []
    else extraContactStackPropNamesCache = []
    return []
  }
}

async function mergedCompanyPropertiesForApi(): Promise<string[]> {
  const extra = await getExtraStackPropertyNamesForObjectType('companies')
  return Array.from(new Set([...allCompanyProperties(), ...extra]))
}

async function mergedContactPropertiesForApi(): Promise<string[]> {
  const extra = await getExtraStackPropertyNamesForObjectType('contacts')
  return Array.from(new Set([...allContactProperties(), ...extra]))
}

function mergeBookingSoftwareFromContact(
  company: HubSpotCompany,
  contact: HubSpotContact,
  crmTimelineNotes?: string
): HubSpotCompany {
  const studioDomain = company.properties?.domain ?? null
  if (
    pickBookingSoftwareDeep(
      company.properties as Record<string, string | null | undefined>,
      studioDomain
    )
  ) {
    return company
  }
  const fromContact = pickBookingSoftwareDeep(
    contact.properties as Record<string, string | null | undefined>,
    studioDomain
  )
  const combined = [contact.lastCall?.notes, crmTimelineNotes]
    .filter((s): s is string => typeof s === 'string' && s.trim().length > 0)
    .join('\n\n')
  const fromNotes = extractBookingSoftwareFromCallNotes(combined || undefined)
  const raw = fromContact || fromNotes
  if (!raw) return company
  const resolved =
    normalizeBookingSoftwareValue(raw, studioDomain) ||
    (/https?:\/\//i.test(raw) ? null : raw)
  if (!resolved) return company
  return {
    ...company,
    properties: {
      ...company.properties,
      promptloop_booking_software: resolved,
    },
  }
}

/** Coerce booking URLs on the company record to vendor names for UI + prompts. */
function normalizeCompanyBookingDisplay(co: HubSpotCompany): HubSpotCompany {
  const props = { ...co.properties } as Record<string, string | null | undefined>
  let changed = false
  for (const [k, v] of Object.entries(props)) {
    if (typeof v !== 'string' || !v.trim() || !/https?:\/\//i.test(v)) continue
    const n = normalizeBookingSoftwareValue(v, co.properties?.domain ?? null)
    if (n && n !== v.trim()) {
      props[k] = n
      changed = true
    }
  }
  return changed ? { ...co, properties: props as HubSpotCompany['properties'] } : co
}

type HubSpotNoteRecord = {
  id: string
  properties?: Record<string, string | null | undefined>
}

/** Contact → CRM Notes (timeline). Requires crm.objects.notes.read on the Private App. */
async function getContactAssociatedNoteIds(contactId: string): Promise<string[]> {
  const ids: string[] = []
  let after: string | undefined
  try {
    for (let page = 0; page < 25; page++) {
      const qs = new URLSearchParams()
      if (after) qs.set('after', after)
      const q = qs.toString() ? `?${qs}` : ''
      const data = (await hubspotFetch(
        `/crm/v3/objects/contacts/${encodeURIComponent(contactId)}/associations/notes${q}`
      )) as {
        results?: Array<{ toObjectId?: string | number; id?: string | number }>
        paging?: { next?: { after?: string } }
      }
      for (const r of data.results || []) {
        const id = r.toObjectId ?? r.id
        if (id != null && String(id) !== '') ids.push(String(id))
      }
      after = data.paging?.next?.after
      if (!after) break
    }
  } catch {
    return []
  }
  return ids
}

async function batchReadHubSpotNotes(noteIds: string[]): Promise<HubSpotNoteRecord[]> {
  if (noteIds.length === 0) return []
  const out: HubSpotNoteRecord[] = []
  for (let i = 0; i < noteIds.length; i += 100) {
    const slice = noteIds.slice(i, i + 100)
    try {
      const data = (await hubspotFetch('/crm/v3/objects/notes/batch/read', {
        method: 'POST',
        body: JSON.stringify({
          properties: ['hs_note_body', 'hs_timestamp', 'hs_createdate'],
          inputs: slice.map((id) => ({ id })),
        }),
      })) as { results?: HubSpotNoteRecord[] }
      out.push(...(data.results || []))
    } catch {
      /* missing crm.objects.notes.read */
    }
  }
  return out
}

function hubSpotNoteTimeMs(props: Record<string, string | null | undefined> | undefined): number {
  if (!props) return 0
  const ts = props.hs_timestamp?.trim() || props.hs_createdate?.trim()
  if (!ts) return 0
  const n = Number(ts)
  if (Number.isFinite(n) && n > 1e11) return n
  const d = Date.parse(ts)
  return Number.isNaN(d) ? 0 : d
}

/**
 * Bodies of CRM notes on the contact (newest first), for parsing booking stack.
 * Capped for prompt size and API cost.
 */
export async function fetchHubSpotCrmTimelineNotesForContact(contactId: string): Promise<string> {
  const ids = await getContactAssociatedNoteIds(contactId)
  if (ids.length === 0) return ''
  const records = await batchReadHubSpotNotes(ids)
  records.sort(
    (a, b) =>
      hubSpotNoteTimeMs(b.properties) - hubSpotNoteTimeMs(a.properties)
  )
  const bodies: string[] = []
  let total = 0
  const maxChars = 12_000
  for (const r of records) {
    const body = r.properties?.hs_note_body?.trim()
    if (!body) continue
    if (total + body.length > maxChars) break
    bodies.push(body)
    total += body.length + 2
  }
  return bodies.join('\n\n')
}

/**
 * HubSpot GET /crm/v3/lists only returns lists when you pass `listIds`.
 * To list all lists, use POST /crm/v3/lists/search with empty `query` (see HubSpot CRM Lists API).
 * We only include **contact** lists (objectTypeId 0-1) since this app loads contacts from memberships.
 */
export async function getLists(): Promise<HubSpotList[]> {
  const aggregated: HubSpotList[] = []
  let offset = 0
  const count = 100
  const maxPages = 50

  for (let page = 0; page < maxPages; page++) {
    const data = await hubspotFetch('/crm/v3/lists/search', {
      method: 'POST',
      body: JSON.stringify({
        additionalProperties: [] as string[],
        offset,
        count,
        // Omit query → all lists (per API: "page through all lists by providing an empty query value")
      }),
    })

    const raw = (data.lists || []) as Array<{
      listId: string | number
      name: string
      objectTypeId?: string | number
      processingType?: string
      createdAt?: string
      updatedAt?: string
    }>

    for (const item of raw) {
      // Only contact lists — app reads contact memberships from each list.
      const ot = String(item.objectTypeId ?? '')
      if (ot !== '0-1') continue

      const id =
        typeof item.listId === 'string' ? parseInt(item.listId, 10) : Number(item.listId)
      if (!Number.isFinite(id)) continue
      aggregated.push({
        listId: id,
        name: item.name,
        listType: item.processingType || 'UNKNOWN',
        createdAt: item.createdAt || '',
        updatedAt: item.updatedAt || '',
      })
    }

    if (!data.hasMore || raw.length === 0) break
    offset = typeof data.offset === 'number' ? data.offset : offset + raw.length
  }

  return aggregated
}

export async function getListContacts(listId: number, limit = 100): Promise<HubSpotContact[]> {
  const data = await hubspotFetch(
    `/crm/v3/lists/${listId}/memberships?limit=${limit}`
  )
  
  if (!data.results || data.results.length === 0) {
    return []
  }

  // Get the contact IDs from the list
  const contactIds = data.results.map((r: { recordId: string }) => r.recordId)
  
  // Fetch full contact details with properties
  const contacts = await getContactsByIds(contactIds)
  return contacts
}

export async function getContactsByIds(ids: string[]): Promise<HubSpotContact[]> {
  if (ids.length === 0) return []

  const props = await mergedContactPropertiesForApi()
  const data = await hubspotFetch('/crm/v3/objects/contacts/batch/read', {
    method: 'POST',
    body: JSON.stringify({
      properties: props,
      inputs: ids.map(id => ({ id })),
    }),
  })

  return data.results || []
}

export async function getCompany(companyId: string): Promise<HubSpotCompany | null> {
  try {
    const props = await mergedCompanyPropertiesForApi()
    const qs = props.map(encodeURIComponent).join(',')
    if (qs.length > 1800) {
      const data = (await hubspotFetch('/crm/v3/objects/companies/batch/read', {
        method: 'POST',
        body: JSON.stringify({
          properties: props,
          inputs: [{ id: companyId }],
        }),
      })) as { results?: HubSpotCompany[] }
      return data.results?.[0] ?? null
    }
    const data = await hubspotFetch(
      `/crm/v3/objects/companies/${encodeURIComponent(companyId)}?properties=${qs}`
    )
    return data
  } catch {
    return null
  }
}

export async function getCompanyByContactId(contactId: string): Promise<HubSpotCompany | null> {
  try {
    // First get associations
    const associations = await hubspotFetch(
      `/crm/v3/objects/contacts/${contactId}/associations/companies`
    )
    
    if (!associations.results || associations.results.length === 0) {
      return null
    }

    const first = associations.results[0] as { id?: string; toObjectId?: string | number }
    const companyId = String(first.toObjectId ?? first.id ?? '')
    if (!companyId || companyId === 'undefined') return null
    return getCompany(companyId)
  } catch {
    return null
  }
}

/** HubSpot default call outcome GUIDs → readable labels (disposition is often stored as UUID). */
const HUBSPOT_CALL_DISPOSITION_LABEL: Record<string, string> = {
  '9d9162e7-6cf3-4944-bf63-4dff82258764': 'Busy',
  'f240bbac-87c9-4f6e-bf70-924b57d47db7': 'Connected',
  'a4c4c377-d246-4b32-a13b-75a56a4cd0ff': 'Left live message',
  'b2cf5968-551e-4856-9783-52b3da59a7d0': 'Left voicemail',
  '73a0d17f-1163-4015-bdd5-ec830791da20': 'No answer',
  '17b47fee-58de-441e-a44c-c6300d46f273': 'Wrong number',
}

function formatCallDisposition(raw: string | null | undefined): string | undefined {
  if (!raw?.trim()) return undefined
  const t = raw.trim()
  const mapped = HUBSPOT_CALL_DISPOSITION_LABEL[t.toLowerCase()]
  if (mapped) return mapped
  if (/^[0-9a-f-]{36}$/i.test(t)) return undefined
  return t.replace(/_/g, ' ')
}

function isNooksPlaceholderBody(body: string): boolean {
  return /^\[NOOKS\]\s*-\s*$/i.test(body.trim())
}

function hubSpotTimestampToMs(ts: string | null | undefined): number {
  if (!ts) return 0
  const n = Number(ts)
  if (Number.isFinite(n) && n > 1e11) return n
  const d = Date.parse(ts)
  return Number.isNaN(d) ? 0 : d
}

function hubSpotTimestampToIso(ts: string | null | undefined): string {
  const ms = hubSpotTimestampToMs(ts)
  return ms > 0 ? new Date(ms).toISOString() : new Date().toISOString()
}

const HUBSPOT_CALL_READ_PROPERTIES = [
  'hs_timestamp',
  'hs_call_body',
  'hs_call_title',
  'hs_call_disposition',
  'hs_call_direction',
  'hs_call_duration',
  'hs_call_transcription_id',
  'hs_call_recording_url',
] as const

type HubSpotCallApiRecord = {
  id: string
  properties?: Record<string, string | null | undefined>
}

async function fetchHubSpotNoteBody(noteId: string): Promise<string> {
  try {
    const data = (await hubspotFetch(
      `/crm/v3/objects/notes/${encodeURIComponent(noteId)}?properties=hs_note_body`
    )) as { properties?: { hs_note_body?: string | null } }
    return data.properties?.hs_note_body?.trim() || ''
  } catch {
    return ''
  }
}

async function getContactAssociatedCallIds(contactId: string): Promise<string[]> {
  const ids: string[] = []
  let after: string | undefined
  try {
    for (let page = 0; page < 25; page++) {
      const qs = new URLSearchParams()
      if (after) qs.set('after', after)
      const q = qs.toString() ? `?${qs}` : ''
      const data = (await hubspotFetch(
        `/crm/v3/objects/contacts/${encodeURIComponent(contactId)}/associations/calls${q}`
      )) as {
        results?: Array<{ toObjectId?: string | number; id?: string | number }>
        paging?: { next?: { after?: string } }
      }
      for (const r of data.results || []) {
        const id = r.toObjectId ?? r.id
        if (id != null && String(id) !== '') ids.push(String(id))
      }
      after = data.paging?.next?.after
      if (!after) break
    }
  } catch {
    return []
  }
  return ids
}

async function batchReadHubSpotCalls(callIds: string[]): Promise<HubSpotCallApiRecord[]> {
  if (callIds.length === 0) return []
  const out: HubSpotCallApiRecord[] = []
  for (let i = 0; i < callIds.length; i += 100) {
    const slice = callIds.slice(i, i + 100)
    try {
      const data = (await hubspotFetch('/crm/v3/objects/calls/batch/read', {
        method: 'POST',
        body: JSON.stringify({
          properties: [...HUBSPOT_CALL_READ_PROPERTIES],
          inputs: slice.map((id) => ({ id })),
        }),
      })) as { results?: HubSpotCallApiRecord[] }
      out.push(...(data.results || []))
    } catch {
      /* missing crm.objects.calls.read or batch error */
    }
  }
  return out
}

function buildCallNotesFromProperties(
  props: Record<string, string | null | undefined>,
  transcript: string
): string {
  const title = (props.hs_call_title || '').trim()
  const bodyRaw = (props.hs_call_body || '').trim()
  const recording = (props.hs_call_recording_url || '').trim()

  let notes = ''
  if (transcript && (isNooksPlaceholderBody(bodyRaw) || !bodyRaw)) {
    notes = transcript
  } else if (bodyRaw && !isNooksPlaceholderBody(bodyRaw)) {
    notes = bodyRaw
    if (
      transcript &&
      transcript.length > 20 &&
      !notes.includes(transcript.slice(0, Math.min(60, transcript.length)))
    ) {
      notes = `${notes}\n\n---\nTranscript:\n${transcript}`
    }
  } else if (transcript) {
    notes = transcript
  }

  if (title && notes && !notes.includes(title)) {
    notes = `${title}\n\n${notes}`
  }

  if (!notes.trim() && recording) {
    notes = `No text notes in HubSpot. Recording: ${recording}`
  }
  if (!notes.trim()) {
    notes =
      'No call notes or transcript on this activity in HubSpot. For Nooks + transcripts, ensure the Private App can read calls and notes (crm.objects.calls.read, crm.objects.notes.read).'
  }
  return notes.trim()
}

/**
 * Preferred path: CRM v3 calls linked to the contact (Nooks and other dialers use this).
 * Pulls hs_call_body and, when the body is empty or a Nooks stub, linked note transcript.
 */
async function getLastCallFromCrmCallsApi(contactId: string): Promise<HubSpotCallNote | null> {
  const callIds = await getContactAssociatedCallIds(contactId)
  if (callIds.length === 0) return null

  const records = await batchReadHubSpotCalls(callIds)
  if (records.length === 0) return null

  records.sort(
    (a, b) =>
      hubSpotTimestampToMs(b.properties?.hs_timestamp) -
      hubSpotTimestampToMs(a.properties?.hs_timestamp)
  )

  const latest = records[0]
  const props = latest.properties || {}
  const bodyRaw = (props.hs_call_body || '').trim()
  const transcriptionId = props.hs_call_transcription_id?.trim()

  const transcript = transcriptionId ? await fetchHubSpotNoteBody(transcriptionId) : ''

  const notes = buildCallNotesFromProperties(props, transcript)
  const dispGuid = props.hs_call_disposition?.trim()
  const dispositionLabel =
    (dispGuid && HUBSPOT_CALL_DISPOSITION_LABEL[dispGuid.toLowerCase()]) ||
    formatCallDisposition(dispGuid)

  const durationMs = props.hs_call_duration
  return {
    id: latest.id,
    date: hubSpotTimestampToIso(props.hs_timestamp ?? undefined),
    notes,
    direction: props.hs_call_direction ?? undefined,
    duration:
      durationMs != null && durationMs !== ''
        ? Math.round(Number(durationMs) / 1000)
        : undefined,
    disposition: dispositionLabel,
  }
}

/** Legacy engagements v1 (timeline scope). Used when CRM calls API returns nothing. */
async function getLastCallFromLegacyEngagements(
  contactId: string
): Promise<HubSpotCallNote | null> {
  try {
    const data = await hubspotFetch(
      `/engagements/v1/engagements/associated/contact/${contactId}/paged?limit=100`
    )

    const engagements: {
      engagement: {
        id: number
        type: string
        timestamp: number
      }
      metadata: {
        body?: string
        durationMilliseconds?: number
        direction?: string
        disposition?: string
      }
    }[] = data.results || []

    const calls = engagements
      .filter((e) => e.engagement.type === 'CALL')
      .sort((a, b) => b.engagement.timestamp - a.engagement.timestamp)

    if (calls.length === 0) return null

    const latest = calls[0]
    const body = latest.metadata.body?.trim() || ''
    const dispRaw = latest.metadata.disposition?.trim()
    const dispositionLabel =
      (dispRaw && HUBSPOT_CALL_DISPOSITION_LABEL[dispRaw.toLowerCase()]) ||
      formatCallDisposition(dispRaw)

    let notes = body
    if (isNooksPlaceholderBody(body)) {
      notes =
        'Call logged from Nooks; HubSpot did not return note text on this legacy activity. Prefer CRM calls + notes scopes, or open the call in HubSpot to view the transcript.'
    }

    return {
      id: String(latest.engagement.id),
      date: new Date(latest.engagement.timestamp).toISOString(),
      notes,
      direction: latest.metadata.direction,
      duration: latest.metadata.durationMilliseconds
        ? Math.round(latest.metadata.durationMilliseconds / 1000)
        : undefined,
      disposition: dispositionLabel,
    }
  } catch {
    return null
  }
}

/**
 * Most recent call for a contact. Tries CRM v3 calls + linked note transcripts (Nooks),
 * then legacy engagements v1.
 */
export async function getLastCallForContact(contactId: string): Promise<HubSpotCallNote | null> {
  const fromCrm = await getLastCallFromCrmCallsApi(contactId)
  if (fromCrm) return fromCrm
  return getLastCallFromLegacyEngagements(contactId)
}

export async function enrichContactWithCompany(contact: HubSpotContact): Promise<HubSpotContact> {
  const assocCompanyId = contact.properties?.associatedcompanyid?.trim()
  const lastCallPromise = getLastCallForContact(contact.id)
  const companyPromise = (async (): Promise<HubSpotCompany | null> => {
    if (assocCompanyId) {
      const fromId = await getCompany(assocCompanyId)
      if (fromId) return fromId
    }
    return getCompanyByContactId(contact.id)
  })()
  const [company, lastCall] = await Promise.all([companyPromise, lastCallPromise])
  const contactWithCall: HubSpotContact = {
    ...contact,
    lastCall: lastCall || undefined,
  }

  const studioDomain = company?.properties?.domain ?? null
  const crmFieldsHaveBooking =
    pickBookingSoftwareDeep(
      contact.properties as Record<string, string | null | undefined>,
      studioDomain
    ) ||
    (company
      ? pickBookingSoftwareDeep(
          company.properties as Record<string, string | null | undefined>,
          studioDomain
        )
      : false)
  const callTextHasBooking = extractBookingSoftwareFromCallNotes(lastCall?.notes)

  let crmTimelineNotes = ''
  if (!crmFieldsHaveBooking && !callTextHasBooking) {
    crmTimelineNotes = await fetchHubSpotCrmTimelineNotesForContact(contact.id)
  }

  let co = company || undefined
  if (co) {
    co = mergeBookingSoftwareFromContact(co, contactWithCall, crmTimelineNotes || undefined)
    co = normalizeCompanyBookingDisplay(co)
  }

  return {
    ...contactWithCall,
    company: co,
    hubspotCrmNotesText: crmTimelineNotes || undefined,
  }
}

export async function enrichContactsWithCompanies(contacts: HubSpotContact[]): Promise<HubSpotContact[]> {
  const enrichedContacts = await Promise.all(
    contacts.map(contact => enrichContactWithCompany(contact))
  )
  return enrichedContacts
}

/**
 * Single-contact CRM read with full enrichment (company, last call, notes when needed).
 * Use from /api/generate so booking/stack fields from the **company** are always current.
 */
export async function fetchAndEnrichContactById(contactId: string): Promise<HubSpotContact | null> {
  if (!contactId?.trim()) return null
  try {
    const token = hubspotAccessToken()
    if (!token || tIsPlaceholder(token)) return null
    const props = await mergedContactPropertiesForApi()
    let data: { id?: string; properties: HubSpotContact['properties'] }
    if (props.join(',').length > 1800) {
      const batch = (await hubspotFetch('/crm/v3/objects/contacts/batch/read', {
        method: 'POST',
        body: JSON.stringify({
          properties: props,
          inputs: [{ id: contactId }],
        }),
      })) as { results?: { id: string; properties: HubSpotContact['properties'] }[] }
      const row = batch.results?.[0]
      if (!row?.id) return null
      data = row
    } else {
      data = (await hubspotFetch(
        `/crm/v3/objects/contacts/${encodeURIComponent(contactId)}?properties=${props.map(encodeURIComponent).join(',')}`
      )) as { id?: string; properties: HubSpotContact['properties'] }
    }
    if (!data?.id) return null
    const contact: HubSpotContact = { id: data.id, properties: data.properties }
    return await enrichContactWithCompany(contact)
  } catch (e) {
    console.warn('[hubspot] fetchAndEnrichContactById failed', e)
    return null
  }
}
