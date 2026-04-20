'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import type { HubSpotContact, HubSpotList, SmartleadCampaign, SmartleadEmailAccount, GeneratedEmail } from '@/types'
import { getEmailSignature, resolveSignatureNameParts } from '@/config/email-style'
import { buildStaticPersonalizedEmail } from '@/lib/static-email'
import { skipGeminiFromPublicEnv } from '@/lib/skip-gemini-env'
import { resolveBookingSoftwareForContact } from '@/lib/booking-software'
import {
  getDailySendCount,
  getMaxSendsPerDayFromEnv,
  incrementDailySendCount,
} from '@/lib/daily-send-cap'
import { parseSmartleadCampaignListJson } from '@/lib/smartlead-campaign-list'
import CampaignSelector from './CampaignSelector'
import ListSelector from './ListSelector'
import LeadCard from './LeadCard'
import EmailEditor from './EmailEditor'

interface DashboardClientProps {
  userId: string
  userEmail: string
  firstName: string
  lastName: string
  /** From server: real HubSpot lists + contacts when true (matches Vercel at request time). */
  hubspotLive: boolean
  /** From server: Smartlead console-only sends when true. */
  smartleadTestOnly: boolean
}

type Step = 'select-campaign' | 'select-list' | 'lead-hub' | 'work-single-lead'

type SmartleadSendResponse = {
  success?: boolean
  error?: string
  message?: string
  added_count?: number
  smartlead?: unknown
}

async function parseSmartleadSendResponse(res: Response): Promise<SmartleadSendResponse> {
  const data = (await res.json().catch(() => ({}))) as SmartleadSendResponse
  if (!res.ok) {
    throw new Error(data.error || `Smartlead send failed (${res.status})`)
  }
  if (data.success === false) {
    throw new Error(data.error || 'Smartlead did not add this lead (see response in Network tab).')
  }
  return data
}

function leadHubBlurb(lead: HubSpotContact): string {
  const co = lead.company?.properties
  const bits: string[] = []
  if (co?.name) bits.push(co.name)
  const loc = [co?.city, co?.state].filter(Boolean).join(', ')
  if (loc) bits.push(loc)
  if (lead.properties.jobtitle) bits.push(lead.properties.jobtitle)
  const sw = resolveBookingSoftwareForContact(lead)
  if (sw) bits.push(sw)
  return bits.slice(0, 4).join(' · ') || '—'
}

const MAX_SENDS_PER_DAY = getMaxSendsPerDayFromEnv()

// Mock data for testing when APIs aren't set up
const MOCK_CAMPAIGNS: SmartleadCampaign[] = [
  { id: 1, name: 'Fitness Studios - Cold Outreach', status: 'ACTIVE' },
  { id: 2, name: 'Yoga Studios - Q1 Campaign', status: 'ACTIVE' },
  { id: 3, name: 'Pilates - New Market Test', status: 'PAUSED' },
]

const MOCK_LISTS: HubSpotList[] = [
  { listId: 1, name: 'Fitness Studios - West Coast', listType: 'STATIC', createdAt: '', updatedAt: '' },
  { listId: 2, name: 'Yoga Studios - High Intent', listType: 'DYNAMIC', createdAt: '', updatedAt: '' },
  { listId: 3, name: 'New Leads - February 2026', listType: 'STATIC', createdAt: '', updatedAt: '' },
]

const MOCK_CONTACTS: HubSpotContact[] = [
  {
    id: '101',
    properties: {
      firstname: 'Sarah',
      lastname: 'Johnson',
      jobtitle: 'Studio Owner',
      email: 'sarah@yogabliss.com',
    },
    company: {
      id: '201',
      properties: {
        name: 'Yoga Bliss Studio',
        domain: 'yogabliss.com',
        city: 'San Francisco',
        state: 'CA',
        gtm_modality: 'Yoga',
        promptloop_modalities: 'Yoga, Meditation',
        promptloop_booking_software: 'Mindbody',
        promptloop_number_of_locations: '2',
        promptloop_avg_daily_class_count: '12',
        promptloop_staff_count_website: '8',
        promptloop_staff_count_booking_page: '6',
        gmaps_ratings: '4.8',
        gmaps_reviews: '245',
      },
    },
    lastCall: {
      id: 'mock-call-1',
      date: '2026-01-15T14:30:00Z',
      notes: 'Sarah was interested but concerned about Arketa\'s pricing. Said timing wasn\'t right in Q4 and to follow up in the new year.',
      disposition: 'CONNECTED',
    },
  },
  {
    id: '102',
    properties: {
      firstname: 'Mike',
      lastname: 'Chen',
      jobtitle: 'General Manager',
      email: 'mike@fitnessplus.com',
    },
    company: {
      id: '202',
      properties: {
        name: 'Fitness Plus',
        domain: 'fitnessplus.com',
        city: 'Los Angeles',
        state: 'CA',
        gtm_modality: 'Gym',
        promptloop_modalities: 'Fitness, CrossFit',
        promptloop_booking_software: 'ClubReady',
        promptloop_number_of_locations: '5',
        promptloop_avg_daily_class_count: '25',
        promptloop_staff_count_website: '15',
        promptloop_staff_count_booking_page: '12',
        gmaps_ratings: '4.6',
        gmaps_reviews: '512',
      },
    },
  },
  {
    id: '103',
    properties: {
      firstname: 'Emma',
      lastname: 'Williams',
      jobtitle: 'Owner',
      email: 'emma@pilatesco.com',
    },
    company: {
      id: '203',
      properties: {
        name: 'Pilates Co',
        domain: 'pilatesco.com',
        city: 'Denver',
        state: 'CO',
        gtm_modality: 'Pilates',
        promptloop_modalities: 'Pilates, Barre',
        promptloop_booking_software: 'WellnessLiving',
        promptloop_number_of_locations: '1',
        promptloop_avg_daily_class_count: '8',
        promptloop_staff_count_website: '4',
        promptloop_staff_count_booking_page: '4',
        gmaps_ratings: '4.9',
        gmaps_reviews: '89',
      },
    },
  },
]

export default function DashboardClient({
  userId,
  userEmail,
  firstName,
  lastName,
  hubspotLive,
  smartleadTestOnly,
}: DashboardClientProps) {
  const fullMockDemo = !hubspotLive
  const smartleadSendMocked = smartleadTestOnly || fullMockDemo

  const [step, setStep] = useState<Step>('select-campaign')
  const [campaigns, setCampaigns] = useState<SmartleadCampaign[]>([])
  const [lists, setLists] = useState<HubSpotList[]>([])
  /** Every Smartlead mailbox on the account (for manual pick). */
  const [allSmartleadInboxes, setAllSmartleadInboxes] = useState<SmartleadEmailAccount[]>([])
  /** Which inbox IDs to pass to Smartlead on send (user-chosen; persists per user in localStorage). */
  const [selectedInboxIds, setSelectedInboxIds] = useState<Set<number>>(new Set())
  const [selectedCampaign, setSelectedCampaign] = useState<SmartleadCampaign | null>(null)
  const [selectedList, setSelectedList] = useState<HubSpotList | null>(null)
  const [leads, setLeads] = useState<HubSpotContact[]>([])
  const [currentLeadIndex, setCurrentLeadIndex] = useState(0)
  const [generatedEmail, setGeneratedEmail] = useState<GeneratedEmail | null>(null)
  const [emailFromApi, setEmailFromApi] = useState(true) // false = showing mock because API failed
  const [usingStaticTemplate, setUsingStaticTemplate] = useState(false) // true when SKIP_GEMINI_PERSONALIZATION (no AI)
  const [generateError, setGenerateError] = useState<string | null>(null) // last error from /api/generate when showing mock
  /** Initial load: Smartlead campaigns + inboxes only */
  const [isLoading, setIsLoading] = useState(true)
  const [isFetchingHubspotLists, setIsFetchingHubspotLists] = useState(false)
  const [isFetchingContacts, setIsFetchingContacts] = useState(false)
  const [isSending, setIsSending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  /** After a successful Smartlead API call — enrollment, not guaranteed instant inbox delivery */
  const [smartleadInfo, setSmartleadInfo] = useState<string | null>(null)
  /** Shown on campaign step when API returned 200 but zero campaigns (wrong key / agency client). */
  const [campaignsLoadHint, setCampaignsLoadHint] = useState<string | null>(null)
  const [sentLeadIds, setSentLeadIds] = useState<Set<string>>(new Set())
  /** Smartlead enrollments today (this browser); synced from localStorage */
  const [dailySentCount, setDailySentCount] = useState(0)
  const [contactSearch, setContactSearch] = useState('')
  const [searchFocused, setSearchFocused] = useState(false)
  const [bulkSelectedIds, setBulkSelectedIds] = useState<Set<string>>(new Set())
  const [bulkListExpanded, setBulkListExpanded] = useState(false)
  const [leadHubChooseMode, setLeadHubChooseMode] = useState(false)
  const [bulkRunning, setBulkRunning] = useState(false)
  const [bulkProgress, setBulkProgress] = useState({ current: 0, total: 0, name: '' })
  const [bulkLastResult, setBulkLastResult] = useState<{
    ok: number
    failed: number
    errors: { email: string; message: string }[]
  } | null>(null)
  /** Linear walk: preview each lead with email (Next / Send & next) */
  const [previewAllMode, setPreviewAllMode] = useState(false)

  const leadIndicesWithEmail = leads
    .map((l, i) => ((l.properties.email || '').trim() ? i : -1))
    .filter((i): i is number => i >= 0)

  const nextLeadIndexWithEmail = (fromIndex: number): number | null => {
    for (let i = fromIndex + 1; i < leads.length; i++) {
      if ((leads[i].properties.email || '').trim()) return i
    }
    return null
  }

  const searchMatches = contactSearch.trim()
    ? leads.filter((lead) => {
        const q = contactSearch.trim().toLowerCase()
        const first = (lead.properties.firstname || '').toLowerCase()
        const last = (lead.properties.lastname || '').toLowerCase()
        const email = (lead.properties.email || '').toLowerCase()
        const company = (lead.company?.properties?.name || '').toLowerCase()
        return (
          first.includes(q) ||
          last.includes(q) ||
          email.includes(q) ||
          company.includes(q) ||
          `${first} ${last}`.trim().includes(q) ||
          `${last} ${first}`.trim().includes(q)
        )
      })
    : []

  const fetchInitialData = useCallback(async () => {
    setIsLoading(true)
    setError(null)
    setCampaignsLoadHint(null)
    const ctrl = new AbortController()
    const t = setTimeout(() => ctrl.abort(), 20000)
    try {
      const [campaignsRes, inboxesRes, accountsRes] = await Promise.all([
        fetch('/api/smartlead/campaigns', { signal: ctrl.signal }),
        fetch(
          `/api/smartlead/inboxes?firstName=${encodeURIComponent(firstName)}&lastName=${encodeURIComponent(lastName)}`,
          { signal: ctrl.signal }
        ),
        fetch('/api/smartlead/email-accounts', { signal: ctrl.signal }),
      ])

      let loadedCampaigns: SmartleadCampaign[] = []
      let inboxesData: { inboxes: SmartleadEmailAccount[] } = { inboxes: [] }
      let accounts: SmartleadEmailAccount[] = []

      if (campaignsRes.ok) {
        const raw = await campaignsRes.json().catch(() => ({}))
        loadedCampaigns = parseSmartleadCampaignListJson(raw)
      } else if (!smartleadSendMocked) {
        const errBody = (await campaignsRes.json().catch(() => ({}))) as { error?: string }
        setError(
          errBody.error ||
            `Smartlead campaigns could not be loaded (HTTP ${campaignsRes.status}). Set SMARTLEAD_API_KEY in Vercel → Project → Environment Variables (Production), redeploy, then Reload campaigns. Local check: npm run test:integrations`
        )
      }
      if (inboxesRes.ok) {
        inboxesData = await inboxesRes.json()
      }
      if (accountsRes.ok) {
        const body = (await accountsRes.json()) as { accounts?: SmartleadEmailAccount[] }
        accounts = Array.isArray(body.accounts) ? body.accounts : []
      }

      // Test / demo: still show real campaigns from Smartlead when the API returns them (so search matches Smartlead UI).
      // Only fall back to mock campaign cards when sends are mocked and we have no API campaigns (e.g. no API key).
      const campaignsForPicker =
        smartleadSendMocked && loadedCampaigns.length === 0 ? MOCK_CAMPAIGNS : loadedCampaigns
      setCampaigns(campaignsForPicker)

      if (
        campaignsRes.ok &&
        loadedCampaigns.length === 0 &&
        !smartleadSendMocked
      ) {
        setCampaignsLoadHint(
          'Smartlead returned no campaigns for this API key. The key may be for a different Smartlead user than the UI where you see the campaign, or your campaigns sit under an agency client — add SMARTLEAD_CLIENT_ID (Smartlead client id) to Vercel/server env and redeploy, then use Reload campaigns below.'
        )
      }

      const matched = inboxesData.inboxes || []
      setAllSmartleadInboxes(accounts)

      // Restore saved inbox selection, else default to name-matched inboxes
      if (!smartleadSendMocked && accounts.length > 0) {
        const inboxKey = `sdr-outbound-inbox-ids-${userId}`
        try {
          const raw = typeof window !== 'undefined' ? localStorage.getItem(inboxKey) : null
          if (raw) {
            const ids: number[] = JSON.parse(raw)
            const valid = new Set(ids.filter((id) => accounts.some((a) => a.id === id)))
            if (valid.size > 0) {
              setSelectedInboxIds(valid)
            } else if (matched.length > 0) {
              setSelectedInboxIds(new Set(matched.map((m) => m.id)))
            } else {
              setSelectedInboxIds(new Set())
            }
          } else if (matched.length > 0) {
            setSelectedInboxIds(new Set(matched.map((m) => m.id)))
          } else {
            setSelectedInboxIds(new Set())
          }
        } catch {
          setSelectedInboxIds(
            matched.length > 0 ? new Set(matched.map((m) => m.id)) : new Set()
          )
        }
      } else {
        setSelectedInboxIds(new Set())
      }
    } catch (err) {
      setCampaignsLoadHint(null)
      if (smartleadSendMocked) {
        setCampaigns(MOCK_CAMPAIGNS)
        setAllSmartleadInboxes([])
        setSelectedInboxIds(new Set())
      } else {
        setError(err instanceof Error ? err.message : 'An error occurred')
      }
    } finally {
      clearTimeout(t)
      setIsLoading(false)
    }
  }, [firstName, lastName, userId, smartleadSendMocked])

  // Fetch campaigns and user inboxes on mount
  useEffect(() => {
    fetchInitialData()
  }, [fetchInitialData])

  useEffect(() => {
    if (smartleadSendMocked || selectedInboxIds.size === 0 || typeof window === 'undefined') return
    try {
      localStorage.setItem(
        `sdr-outbound-inbox-ids-${userId}`,
        JSON.stringify(Array.from(selectedInboxIds))
      )
    } catch {
      /* ignore quota */
    }
  }, [userId, selectedInboxIds, smartleadSendMocked])

  useEffect(() => {
    setDailySentCount(getDailySendCount(userId))
  }, [userId])

  const selectedInboxes = useMemo(
    () => allSmartleadInboxes.filter((a) => selectedInboxIds.has(a.id)),
    [allSmartleadInboxes, selectedInboxIds]
  )

  const inboxIdsForSend = useMemo(() => Array.from(selectedInboxIds), [selectedInboxIds])

  /** Match sign-off to the Smartlead From name when `from_name` is set on the selected inbox(es). */
  const signatureIdentity = useMemo(
    () =>
      resolveSignatureNameParts(allSmartleadInboxes, selectedInboxIds, firstName, lastName),
    [allSmartleadInboxes, selectedInboxIds, firstName, lastName]
  )

  const toggleInboxSelection = (id: number) => {
    setSelectedInboxIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const handleSelectCampaign = async (campaign: SmartleadCampaign) => {
    setSelectedCampaign(campaign)
    setError(null)

    if (fullMockDemo) {
      setLists(MOCK_LISTS)
      setStep('select-list')
      return
    }

    // Go to list step immediately so the app never feels "stuck" on campaign
    setStep('select-list')
    setLists([])
    setIsFetchingHubspotLists(true)
    const ctrl = new AbortController()
    const t = setTimeout(() => ctrl.abort(), 25000)
    try {
      const listsRes = await fetch('/api/hubspot/lists', {
        signal: ctrl.signal,
        cache: 'no-store',
      })
      if (listsRes.ok) {
        const listsData = (await listsRes.json()) as {
          lists?: HubSpotList[]
          error?: string
        }
        const loaded = listsData.lists || []
        setLists(loaded)
        if (loaded.length === 0 && listsData.error) {
          setError(
            `HubSpot: ${listsData.error}. Check HUBSPOT_ACCESS_TOKEN in .env.local and scopes (crm.lists.read).`
          )
        }
      } else {
        const errText = await listsRes.text().catch(() => '')
        throw new Error(
          errText || `HubSpot lists failed (${listsRes.status}). Check HUBSPOT_ACCESS_TOKEN and list scopes.`
        )
      }
    } catch (err) {
      setLists([])
      setError(err instanceof Error ? err.message : 'An error occurred')
    } finally {
      clearTimeout(t)
      setIsFetchingHubspotLists(false)
    }
  }

  const handleSelectList = async (list: HubSpotList) => {
    setSelectedList(list)
    setIsFetchingContacts(true)
    setError(null)
    const ctrl = new AbortController()
    const t = setTimeout(() => ctrl.abort(), 25000)

    try {
      const leadsRes = await fetch(`/api/hubspot/lists/${list.listId}/contacts`, {
        signal: ctrl.signal,
        cache: 'no-store',
      })
      
      let contacts: HubSpotContact[] = []
      
      if (leadsRes.ok) {
        const leadsData = await leadsRes.json()
        contacts = leadsData.contacts || []
      }
      
      // Use mock contacts in test mode if none returned
      if (fullMockDemo && contacts.length === 0) {
        contacts = MOCK_CONTACTS
      }
      
      setLeads(contacts)
      setCurrentLeadIndex(0)
      setBulkSelectedIds(new Set())
      setBulkLastResult(null)
      setBulkListExpanded(false)
      setLeadHubChooseMode(false)
      setStep('lead-hub')
    } catch (err) {
      if (fullMockDemo) {
        // Use mock data when HubSpot is not live
        setLeads(MOCK_CONTACTS)
        setCurrentLeadIndex(0)
        setBulkSelectedIds(new Set())
        setBulkLastResult(null)
        setBulkListExpanded(false)
        setLeadHubChooseMode(false)
        setStep('lead-hub')
      } else {
        setError(err instanceof Error ? err.message : 'An error occurred')
      }
    } finally {
      clearTimeout(t)
      setIsFetchingContacts(false)
    }
  }

  const getEmailForContact = useCallback(
    async (
      lead: HubSpotContact
    ): Promise<{
      email: GeneratedEmail
      fromApi: boolean
      skippedGemini?: boolean
      contact?: HubSpotContact
    }> => {
      // Client-visible flag — avoids calling /api/generate at all (fixes “I set skip but still 429”).
      if (skipGeminiFromPublicEnv()) {
        return {
          email: buildStaticPersonalizedEmail(
            lead,
            signatureIdentity.first,
            signatureIdentity.last
          ),
          fromApi: true,
          skippedGemini: true,
        }
      }

      const res = await fetch('/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contact: lead,
          campaignName: selectedCampaign?.name,
          senderFirstName: signatureIdentity.first,
          senderLastName: signatureIdentity.last,
        }),
      })
      const data = (await res.json().catch(() => ({}))) as {
        email?: GeneratedEmail
        error?: string
        skippedGemini?: boolean
        contact?: HubSpotContact
      }
      if (res.ok && data.email) {
        return {
          email: data.email,
          fromApi: true,
          skippedGemini: Boolean(data.skippedGemini),
          contact: data.contact,
        }
      }
      if (smartleadSendMocked) {
        return {
          email: buildStaticPersonalizedEmail(
            lead,
            signatureIdentity.first,
            signatureIdentity.last
          ),
          fromApi: false,
          skippedGemini: false,
        }
      }
      throw new Error(data?.error || 'Failed to generate email')
    },
    [selectedCampaign?.name, signatureIdentity.first, signatureIdentity.last, smartleadSendMocked]
  )

  const generateEmailForLead = async (lead: HubSpotContact) => {
    setIsLoading(true)
    setGeneratedEmail(null)
    setEmailFromApi(true)
    setUsingStaticTemplate(false)
    setGenerateError(null)

    try {
      const { email, fromApi, skippedGemini, contact: enrichedFromServer } =
        await getEmailForContact(lead)
      setGeneratedEmail(email)
      setEmailFromApi(fromApi)
      setUsingStaticTemplate(Boolean(skippedGemini))
      setGenerateError(fromApi ? null : 'API unavailable — showing preview copy')
      if (fromApi && enrichedFromServer?.id) {
        setLeads((prev) =>
          prev.map((l) => (String(l.id) === String(enrichedFromServer.id) ? enrichedFromServer : l))
        )
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to generate email'
      setError(message)
      setUsingStaticTemplate(false)
    } finally {
      setIsLoading(false)
    }
  }

  const startPreviewAll = async () => {
    const first = leads.findIndex((l) => (l.properties.email || '').trim())
    if (first < 0) {
      setError('No contacts in this list have an email address.')
      return
    }
    setError(null)
    setPreviewAllMode(true)
    setLeadHubChooseMode(false)
    setBulkListExpanded(false)
    setContactSearch('')
    setCurrentLeadIndex(first)
    setStep('work-single-lead')
    await generateEmailForLead(leads[first])
  }

  const handleNextPreviewOnly = async () => {
    const next = nextLeadIndexWithEmail(currentLeadIndex)
    if (next === null) {
      setPreviewAllMode(false)
      setGeneratedEmail(null)
      setStep('lead-hub')
      return
    }
    setCurrentLeadIndex(next)
    await generateEmailForLead(leads[next])
  }

  const openLeadFromHub = async (index: number) => {
    setPreviewAllMode(false)
    setCurrentLeadIndex(index)
    setStep('work-single-lead')
    setLeadHubChooseMode(false)
    setBulkListExpanded(false)
    setContactSearch('')
    setSearchFocused(false)
    await generateEmailForLead(leads[index])
  }

  const handleBulkSend = async () => {
    if (!selectedCampaign) return
    if (!smartleadSendMocked && inboxIdsForSend.length === 0) {
      setError('Choose at least one Smartlead sending inbox (see “Send from which inbox?” above).')
      return
    }
    const eligible = leads.filter(
      (l) =>
        bulkSelectedIds.has(l.id) &&
        !sentLeadIds.has(l.id) &&
        (l.properties.email || '').trim()
    )
    if (eligible.length === 0) {
      setError('Select leads with email who have not been sent yet.')
      return
    }

    let toProcess = eligible
    let capNote = ''
    if (!smartleadSendMocked && MAX_SENDS_PER_DAY != null) {
      const used = getDailySendCount(userId)
      const remaining = Math.max(0, MAX_SENDS_PER_DAY - used)
      if (remaining <= 0) {
        setError(dailyCapBlockedReason)
        return
      }
      if (eligible.length > remaining) {
        toProcess = eligible.slice(0, remaining)
        capNote = `\n\nDaily cap: only ${remaining} enrollment(s) left today — processing ${toProcess.length} of ${eligible.length} selected.`
      }
    }

    const estMin = Math.max(1, Math.ceil((toProcess.length * 2.5) / 60))
    if (
      !window.confirm(
        `${smartleadSendMocked ? 'Process' : 'Send'} ${toProcess.length} lead${toProcess.length === 1 ? '' : 's'} at once?\n\nEach gets its own AI-personalized email, then ${smartleadSendMocked ? 'logs to the browser console (test mode).' : 'goes to Smartlead.'}${capNote}\n\nRough time: ~${estMin}+ minutes. Leave this tab open.`
      )
    ) {
      return
    }
    setError(null)
    setSmartleadInfo(null)
    setBulkLastResult(null)
    setBulkRunning(true)
    const errList: { email: string; message: string }[] = []
    let ok = 0
    for (let i = 0; i < toProcess.length; i++) {
      const lead = toProcess[i]
      setBulkProgress({
        current: i + 1,
        total: toProcess.length,
        name:
          `${lead.properties.firstname || ''} ${lead.properties.lastname || ''}`.trim() ||
          lead.properties.email ||
          '',
      })
      try {
        const { email } = await getEmailForContact(lead)
        if (!smartleadSendMocked) {
          const sendRes = await fetch('/api/smartlead/send', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              campaignId: selectedCampaign.id,
              contact: lead,
              personalizedIntro: email.personalizedIntro,
              subject: email.subject,
              inboxIds: inboxIdsForSend,
              senderSignature: getEmailSignature(
                signatureIdentity.first,
                signatureIdentity.last
              ),
            }),
          })
          await parseSmartleadSendResponse(sendRes)
          incrementDailySendCount(userId, 1)
          setDailySentCount(getDailySendCount(userId))
        } else {
          console.log('[Bulk]', lead.properties.email, email.subject)
        }
        setSentLeadIds((prev) => new Set(prev).add(lead.id))
        ok++
      } catch (e) {
        errList.push({
          email: lead.properties.email || lead.id,
          message: e instanceof Error ? e.message : 'Error',
        })
      }
      await new Promise((r) => setTimeout(r, 350))
    }
    setBulkRunning(false)
    setBulkLastResult({ ok, failed: errList.length, errors: errList })
    if (errList.length > 0) {
      setError(`${errList.length} of ${toProcess.length} failed — see summary below.`)
    } else if (!smartleadSendMocked && ok > 0) {
      setSmartleadInfo(
        `${ok} lead(s) added in Smartlead. Recipients get mail on Smartlead’s schedule — open the campaign there, confirm it’s started, and check Leads / Outbox. See docs/SMARTLEAD-SENDING-CHECKLIST.md.`
      )
    }
  }

  const handleRegenerateEmail = async () => {
    if (leads[currentLeadIndex]) {
      await generateEmailForLead(leads[currentLeadIndex])
    }
  }

  const handleSendEmail = async () => {
    if (!selectedCampaign || !generatedEmail || !leads[currentLeadIndex]) return

    if (
      !smartleadSendMocked &&
      MAX_SENDS_PER_DAY != null &&
      getDailySendCount(userId) >= MAX_SENDS_PER_DAY
    ) {
      setError(dailyCapBlockedReason)
      return
    }

    setIsSending(true)
    setError(null)
    setSmartleadInfo(null)

    try {
      const lead = leads[currentLeadIndex]
      
      if (smartleadSendMocked) {
        // In test mode, just log what would be sent
        console.log('=== TEST MODE: Email Preview ===')
        console.log('Campaign:', selectedCampaign.name)
        console.log('To:', lead.properties.email)
        console.log('Subject:', generatedEmail.subject)
        console.log('Personalized Intro:', generatedEmail.personalizedIntro)
        console.log('================================')
        
        // Simulate a small delay
        await new Promise(resolve => setTimeout(resolve, 500))
      } else {
        const res = await fetch('/api/smartlead/send', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            campaignId: selectedCampaign.id,
            contact: lead,
            personalizedIntro: generatedEmail.personalizedIntro,
            subject: generatedEmail.subject,
            inboxIds: inboxIdsForSend,
            senderSignature: getEmailSignature(
              signatureIdentity.first,
              signatureIdentity.last
            ),
          }),
        })

        const sendData = await parseSmartleadSendResponse(res)
        incrementDailySendCount(userId, 1)
        setDailySentCount(getDailySendCount(userId))
        setSmartleadInfo(
          sendData.message ||
            'Lead added in Smartlead. Mail goes out on their schedule — campaign must be running. See docs/SMARTLEAD-SENDING-CHECKLIST.md.'
        )
      }

      setSentLeadIds((prev) => new Set(prev).add(lead.id))
      setGeneratedEmail(null)

      if (previewAllMode) {
        const next = nextLeadIndexWithEmail(currentLeadIndex)
        if (next !== null) {
          setCurrentLeadIndex(next)
          await generateEmailForLead(leads[next])
        } else {
          setPreviewAllMode(false)
          setStep('lead-hub')
        }
      } else {
        setStep('lead-hub')
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to send email')
    } finally {
      setIsSending(false)
    }
  }

  const handleSkipLead = () => {
    setGeneratedEmail(null)
    setPreviewAllMode(false)
    setStep('lead-hub')
  }

  const handleBack = () => {
    if (step === 'select-list') {
      setStep('select-campaign')
      setSelectedCampaign(null)
    } else if (step === 'lead-hub') {
      setStep('select-list')
      setSelectedList(null)
      setLeads([])
      setCurrentLeadIndex(0)
      setGeneratedEmail(null)
      setBulkSelectedIds(new Set())
      setBulkLastResult(null)
      setBulkListExpanded(false)
      setLeadHubChooseMode(false)
    } else if (step === 'work-single-lead') {
      setStep('lead-hub')
      setGeneratedEmail(null)
      setPreviewAllMode(false)
    }
  }

  const currentLead = leads[currentLeadIndex]
  const isLastLead = true

  const bulkReadyCount = leads.filter(
    (l) =>
      bulkSelectedIds.has(l.id) &&
      !sentLeadIds.has(l.id) &&
      (l.properties.email || '').trim()
  ).length

  const dailyCapActive = MAX_SENDS_PER_DAY != null && !smartleadSendMocked
  const dailyRemainingForUi =
    dailyCapActive && MAX_SENDS_PER_DAY != null
      ? Math.max(0, MAX_SENDS_PER_DAY - dailySentCount)
      : null
  const bulkAllowedToday =
    dailyRemainingForUi === null ? bulkReadyCount : Math.min(bulkReadyCount, dailyRemainingForUi)

  const smartleadDailyCapReached =
    dailyCapActive && MAX_SENDS_PER_DAY != null && dailySentCount >= MAX_SENDS_PER_DAY

  const dailyCapBlockedReason =
    MAX_SENDS_PER_DAY != null
      ? `Daily limit reached (${MAX_SENDS_PER_DAY} Smartlead enrollment${MAX_SENDS_PER_DAY === 1 ? '' : 's'} per calendar day in this browser). Resets at local midnight. Adjust NEXT_PUBLIC_MAX_SENDS_PER_DAY in .env.local.`
      : ''

  if (isLoading && campaigns.length === 0) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-500">Loading...</div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header with progress */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            {step === 'select-campaign' && 'Select a Campaign'}
            {step === 'select-list' && 'Select a HubSpot List'}
            {step === 'lead-hub' && 'How do you want to work this list?'}
            {step === 'work-single-lead' &&
              (previewAllMode ? 'Preview all leads' : 'Review & edit one email')}
          </h1>
          {selectedCampaign && (
            <p className="text-sm text-gray-500 mt-1">
              Campaign: {selectedCampaign.name}
              {selectedList && ` • List: ${selectedList.name}`}
              {step === 'lead-hub' &&
                leads.length > 0 &&
                ` • ${sentLeadIds.size} of ${leads.length} sent this session`}
              {dailyCapActive && MAX_SENDS_PER_DAY != null && (
                <span className="block sm:inline sm:before:content-['•'] sm:before:mx-1 text-amber-800/90">
                  Daily Smartlead cap: {dailySentCount}/{MAX_SENDS_PER_DAY} today (this browser)
                </span>
              )}
            </p>
          )}
        </div>
        
        {step !== 'select-campaign' && (
          <button
            onClick={handleBack}
            className="text-sm text-gray-500 hover:text-gray-700"
          >
            ← Back
          </button>
        )}
      </div>

      {/* Smartlead: pick sending mailbox(es) — Google login stays yours */}
      {!smartleadSendMocked && allSmartleadInboxes.length > 0 && step !== 'select-campaign' && (
        <div className="rounded-lg border border-indigo-200 bg-indigo-50/90 p-4 space-y-3">
          <div>
            <h3 className="text-sm font-semibold text-indigo-950">Send from which Smartlead inbox?</h3>
            <p className="text-xs text-indigo-800/80 mt-1">
              On each send, we link your checked inboxes to this campaign in Smartlead (their API no longer accepts inbox IDs on the add-lead call).{' '}
              <strong>Delivery</strong> is controlled inside Smartlead (campaign started, schedule, templates) — see{' '}
              <code className="text-[10px] bg-white/60 px-1 rounded">docs/SMARTLEAD-SENDING-CHECKLIST.md</code>.
              Sign-off name comes from each inbox&apos;s <strong>From name</strong> in Smartlead when set; otherwise your Google profile name.
            </p>
            <p className="text-xs text-indigo-900/90 mt-1 leading-relaxed">
              You stay signed in as <strong>{userEmail}</strong>. Smartlead will send from the address(es) you check
              below—use an SDR&apos;s connected mailbox (e.g. their <code className="text-[11px] bg-white/80 px-1 rounded">@company.com</code>{' '}
              inbox in Smartlead). Your choice is saved in this browser.
            </p>
          </div>
          <ul className="space-y-2 max-h-52 overflow-y-auto">
            {allSmartleadInboxes.map((acc) => (
              <li key={acc.id}>
                <label className="flex items-start gap-2 cursor-pointer text-sm text-gray-900">
                  <input
                    type="checkbox"
                    className="mt-1 rounded border-gray-300 text-indigo-600"
                    checked={selectedInboxIds.has(acc.id)}
                    onChange={() => toggleInboxSelection(acc.id)}
                  />
                  <span>
                    <span className="font-medium">{acc.email}</span>
                    {acc.from_name ? (
                      <span className="text-gray-600"> — {acc.from_name}</span>
                    ) : null}
                  </span>
                </label>
              </li>
            ))}
          </ul>
          {selectedInboxes.length > 0 ? (
            <p className="text-xs text-indigo-900">
              <span className="font-medium">Will use for send:</span>{' '}
              {selectedInboxes.map((i) => i.email).join(', ')}
            </p>
          ) : (
            <p className="text-xs text-amber-800">
              Select at least one inbox before <strong>Send</strong> or <strong>Send all</strong>.
            </p>
          )}
          {dailyCapActive && MAX_SENDS_PER_DAY != null && (
            <p className="text-xs text-gray-700 border-t border-indigo-100 pt-2 mt-1">
              <strong>Daily enrollment cap:</strong> {dailySentCount}/{MAX_SENDS_PER_DAY} used today
              {dailyRemainingForUi !== null && dailyRemainingForUi > 0
                ? ` · ${dailyRemainingForUi} left`
                : dailyRemainingForUi === 0
                  ? ' · at limit'
                  : ''}
              . Counts only successful Smartlead adds from this app in this browser; resets at local midnight.
            </p>
          )}
        </div>
      )}

      {!smartleadSendMocked && allSmartleadInboxes.length === 0 && !isLoading && step !== 'select-campaign' && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
          <p className="text-sm text-amber-900">
            <span className="font-medium">No Smartlead mailboxes returned.</span> Confirm{' '}
            <code className="text-xs bg-white/80 px-1 rounded">SMARTLEAD_API_KEY</code> and that email accounts exist in
            Smartlead. You need at least one to send.
          </p>
        </div>
      )}

      {smartleadSendMocked && !isLoading && step !== 'select-campaign' && (
        <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
          <p className="text-sm text-purple-800">
            <span className="font-medium">Smartlead test mode</span> — No leads are added in Smartlead; sends log to
            the browser console only. Your real Smartlead campaigns still appear in the picker when the API returns them.
            {hubspotLive ? (
              <>
                {' '}
                <strong>HubSpot is live</strong> (real lists and contacts). Set{' '}
                <code className="text-[10px] bg-white/70 px-1 rounded">
                  NEXT_PUBLIC_SMARTLEAD_TEST_MODE=false
                </code>{' '}
                on the server, or set server-only{' '}
                <code className="text-[10px] bg-white/70 px-1 rounded">SMARTLEAD_LIVE_SENDING=true</code> to force live
                Smartlead even if the public flag is stuck, then redeploy.
              </>
            ) : null}
          </p>
        </div>
      )}

      {/* Error display */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <p className="text-sm text-red-800">{error}</p>
        </div>
      )}

      {smartleadInfo && !error && (
        <div className="bg-sky-50 border border-sky-200 rounded-lg p-4">
          <p className="text-sm text-sky-900">{smartleadInfo}</p>
        </div>
      )}

      {/* Step content */}
      {step === 'select-campaign' && (
        <div className="space-y-4">
          {campaignsLoadHint && (
            <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950">
              {campaignsLoadHint}
            </div>
          )}
          <div className="flex flex-wrap items-center justify-end gap-2">
            <button
              type="button"
              onClick={() => void fetchInitialData()}
              disabled={isLoading}
              className="text-sm font-medium text-indigo-700 hover:text-indigo-900 disabled:opacity-50"
            >
              {isLoading ? 'Loading…' : 'Reload campaigns'}
            </button>
          </div>
          <CampaignSelector
            campaigns={campaigns}
            onSelect={handleSelectCampaign}
            isLoading={isLoading}
            liveMode={!smartleadSendMocked}
          />
        </div>
      )}

      {step === 'select-list' && (
        <>
          {isFetchingHubspotLists && lists.length === 0 && (
            <p className="text-sm text-gray-600 mb-2">Loading your HubSpot lists…</p>
          )}
          {isFetchingContacts && (
            <p className="text-sm text-gray-600 mb-2">Loading contacts from this list…</p>
          )}
          <ListSelector
            lists={lists}
            onSelect={handleSelectList}
            isLoading={
              (isFetchingHubspotLists && lists.length === 0) || isFetchingContacts
            }
          />
          {!isFetchingHubspotLists &&
            lists.length === 0 &&
            error && (
              <div className="mt-4 flex flex-wrap gap-3">
                <button
                  type="button"
                  onClick={() => {
                    if (!selectedCampaign) return
                    void handleSelectCampaign(selectedCampaign)
                  }}
                  className="text-sm px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700"
                >
                  Retry loading lists
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setError(null)
                    setStep('select-campaign')
                    setSelectedCampaign(null)
                    setLists([])
                  }}
                  className="text-sm px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
                >
                  Choose another campaign
                </button>
              </div>
            )}
        </>
      )}

      {step === 'lead-hub' && leads.length === 0 && !isFetchingContacts && (
        <div className="text-center py-12 text-gray-500">No contacts found in this list.</div>
      )}

      {step === 'lead-hub' && leads.length > 0 && (
        <>
          {sentLeadIds.size === leads.length ? (
            <div className="text-center py-12 bg-green-50 rounded-xl border border-green-200">
              <h2 className="text-xl font-semibold text-green-800 mb-2">All done</h2>
              <p className="text-green-700">
                Everyone in this list has been sent (or processed) this session.
              </p>
              <button
                type="button"
                onClick={() => {
                  setStep('select-campaign')
                  setSelectedList(null)
                  setSelectedCampaign(null)
                  setLeads([])
                  setSentLeadIds(new Set())
                }}
                className="mt-4 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
              >
                Start new campaign
              </button>
            </div>
          ) : (
            <div className="space-y-6">
              <p className="text-gray-700 max-w-3xl leading-relaxed">
                <strong className="text-gray-900">Send many at once:</strong> click{' '}
                <strong>Select all unsent</strong>, review the list below, then <strong>Send all</strong> — each
                person gets their own AI-written email. You don&apos;t open them one by one.
                <br />
                <br />
                <strong className="text-gray-900">Or work one lead:</strong> click{' '}
                <strong>Choose lead</strong>, search, then open the editor to tweak the email before sending.
                <br />
                <br />
                <strong className="text-gray-900">Or preview everyone:</strong>{' '}
                <strong>Preview all leads</strong> walks the list one by one — same as the classic flow (read each
                email, then <strong>Next lead</strong> or <strong>Send &amp; next</strong>).
              </p>

              <div className="flex flex-wrap gap-3">
                <button
                  type="button"
                  onClick={() => {
                    setBulkSelectedIds(
                      new Set(
                        leads
                          .filter((l) => !sentLeadIds.has(l.id) && (l.properties.email || '').trim())
                          .map((l) => l.id)
                      )
                    )
                    setBulkListExpanded(true)
                    setLeadHubChooseMode(false)
                  }}
                  className="px-5 py-2.5 rounded-lg bg-indigo-600 text-white font-medium hover:bg-indigo-700 shadow-sm"
                >
                  Select all unsent
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setBulkSelectedIds(new Set())
                    setBulkListExpanded(false)
                  }}
                  className="px-5 py-2.5 rounded-lg border border-gray-300 bg-white font-medium text-gray-800 hover:bg-gray-50"
                >
                  Clear selection
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setLeadHubChooseMode(true)
                    setBulkListExpanded(false)
                    setContactSearch('')
                    setSearchFocused(true)
                  }}
                  className="px-5 py-2.5 rounded-lg border-2 border-primary-600 text-primary-700 font-medium hover:bg-primary-50"
                >
                  Choose lead
                </button>
                <button
                  type="button"
                  onClick={() => void startPreviewAll()}
                  disabled={leadIndicesWithEmail.length === 0}
                  className="px-5 py-2.5 rounded-lg border-2 border-teal-600 text-teal-800 font-medium hover:bg-teal-50 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Preview all leads
                </button>
              </div>

              {leadHubChooseMode && (
                <div className="relative border border-gray-200 rounded-xl p-4 bg-white shadow-sm">
                  <label htmlFor="hub-contact-search" className="block text-sm font-medium text-gray-700 mb-2">
                    Search by name, email, or company
                  </label>
                  <input
                    id="hub-contact-search"
                    type="search"
                    placeholder="Type to search…"
                    value={contactSearch}
                    onChange={(e) => setContactSearch(e.target.value)}
                    onFocus={() => setSearchFocused(true)}
                    onBlur={() => setTimeout(() => setSearchFocused(false), 200)}
                    className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                    autoFocus
                  />
                  {(searchFocused || contactSearch.trim()) && (
                    <div className="absolute z-20 left-4 right-4 mt-2 bg-white border border-gray-200 rounded-lg shadow-xl max-h-64 overflow-y-auto">
                      {searchMatches.length === 0 ? (
                        <p className="px-4 py-3 text-sm text-gray-500">
                          {contactSearch.trim() ? 'No matches.' : 'Type to search.'}
                        </p>
                      ) : (
                        <ul className="py-1">
                          {searchMatches.map((lead) => {
                            const idx = leads.indexOf(lead)
                            return (
                              <li key={lead.id}>
                                <button
                                  type="button"
                                  onMouseDown={(e) => e.preventDefault()}
                                  onClick={() => openLeadFromHub(idx)}
                                  className="w-full text-left px-4 py-2.5 text-sm hover:bg-primary-50 text-gray-800 flex flex-col gap-0.5"
                                >
                                  <span className="font-medium">
                                    {lead.properties.firstname || ''} {lead.properties.lastname || ''}
                                  </span>
                                  <span className="text-gray-500 truncate">{lead.properties.email}</span>
                                  {lead.company?.properties?.name && (
                                    <span className="text-gray-400 text-xs">{lead.company.properties.name}</span>
                                  )}
                                </button>
                              </li>
                            )
                          })}
                        </ul>
                      )}
                    </div>
                  )}
                </div>
              )}

              {bulkListExpanded && (
                <div className="rounded-xl border-2 border-indigo-200 bg-indigo-50/90 p-5 space-y-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <h3 className="font-semibold text-indigo-950 text-lg">
                      {bulkSelectedIds.size === 0
                        ? 'No leads selected'
                        : dailyCapActive && bulkAllowedToday < bulkReadyCount
                          ? `${bulkAllowedToday} to send today (${bulkReadyCount} eligible; daily cap leaves ${bulkAllowedToday})`
                          : `${bulkReadyCount} to send${bulkReadyCount !== bulkSelectedIds.size ? ` (${bulkSelectedIds.size - bulkReadyCount} already sent or no email)` : ''}`}
                    </h3>
                    <span className="text-xs text-indigo-800">
                      Uncheck anyone to remove them from this batch
                    </span>
                  </div>
                  {bulkSelectedIds.size > 0 ? (
                    <div className="max-h-80 overflow-y-auto rounded-lg border border-indigo-100 bg-white divide-y divide-gray-100">
                      {leads
                        .filter((l) => bulkSelectedIds.has(l.id))
                        .map((lead) => {
                          const email = (lead.properties.email || '').trim()
                          const sent = sentLeadIds.has(lead.id)
                          const name =
                            `${lead.properties.firstname || ''} ${lead.properties.lastname || ''}`.trim() ||
                            email ||
                            'Contact'
                          return (
                            <div
                              key={lead.id}
                              className="flex gap-3 px-4 py-3 items-start hover:bg-gray-50/80"
                            >
                              <input
                                type="checkbox"
                                id={`hub-bulk-${lead.id}`}
                                checked={bulkSelectedIds.has(lead.id)}
                                disabled={sent || !email}
                                onChange={() => {
                                  setBulkSelectedIds((prev) => {
                                    const next = new Set(prev)
                                    if (next.has(lead.id)) next.delete(lead.id)
                                    else next.add(lead.id)
                                    return next
                                  })
                                }}
                                className="mt-1 rounded border-gray-300 text-indigo-600"
                              />
                              <label htmlFor={`hub-bulk-${lead.id}`} className="flex-1 min-w-0 cursor-pointer">
                                <div className="font-medium text-gray-900">{name}</div>
                                <div className="text-sm text-gray-600 truncate">{email || 'No email'}</div>
                                <div className="text-xs text-gray-500 mt-1 leading-snug">{leadHubBlurb(lead)}</div>
                              </label>
                              {sent && <span className="text-green-600 text-xs shrink-0">Sent</span>}
                            </div>
                          )
                        })}
                    </div>
                  ) : (
                    <p className="text-sm text-indigo-800 py-4">
                      Click <strong>Select all unsent</strong> above to load everyone into this list.
                    </p>
                  )}
                  {bulkRunning && (
                    <div className="space-y-2">
                      <div className="h-2.5 bg-indigo-100 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-indigo-600 transition-all duration-300"
                          style={{
                            width:
                              bulkProgress.total > 0
                                ? `${Math.round((100 * bulkProgress.current) / bulkProgress.total)}%`
                                : '0%',
                          }}
                        />
                      </div>
                      <p className="text-sm text-indigo-900">
                        {bulkProgress.current} / {bulkProgress.total}: {bulkProgress.name || '…'}
                      </p>
                    </div>
                  )}
                  {bulkLastResult && !bulkRunning && (
                    <div className="text-sm rounded-lg bg-white border border-indigo-100 p-3 space-y-2">
                      <p className="font-medium text-gray-900">
                        Batch done: {bulkLastResult.ok} ok
                        {bulkLastResult.failed > 0 && (
                          <span className="text-red-600">, {bulkLastResult.failed} failed</span>
                        )}
                      </p>
                      {bulkLastResult.errors.length > 0 && (
                        <ul className="text-xs text-red-700 max-h-28 overflow-y-auto list-disc list-inside">
                          {bulkLastResult.errors.slice(0, 15).map((e, i) => (
                            <li key={i}>
                              {e.email}: {e.message}
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  )}
                  <button
                    type="button"
                    disabled={bulkRunning || bulkAllowedToday === 0}
                    onClick={handleBulkSend}
                    className={`w-full sm:w-auto px-8 py-3 rounded-lg font-semibold text-white disabled:opacity-50 disabled:cursor-not-allowed ${
                      smartleadSendMocked ? 'bg-purple-600 hover:bg-purple-700' : 'bg-indigo-600 hover:bg-indigo-700'
                    }`}
                  >
                    {bulkRunning
                      ? 'Working…'
                      : smartleadSendMocked
                        ? `Send all (${bulkReadyCount}) — test: console only`
                        : dailyCapActive && bulkAllowedToday < bulkReadyCount
                          ? `Send next ${bulkAllowedToday} to Smartlead (cap)`
                          : `Send all (${bulkReadyCount}) to Smartlead`}
                  </button>
                </div>
              )}
            </div>
          )}
        </>
      )}

      {step === 'work-single-lead' && currentLead && (
        <>
          <p className="text-sm text-gray-600 bg-gray-50 border border-gray-200 rounded-lg px-4 py-3">
            {previewAllMode ? (
              <>
                <strong className="text-teal-800">Preview-all mode:</strong> use{' '}
                <strong>Next lead</strong> to skip ahead without sending, or{' '}
                <strong>{smartleadSendMocked ? 'Log & next' : 'Send & next'}</strong> to record/send and move on.{' '}
                <strong>Back to list</strong> exits this walk.
              </>
            ) : smartleadSendMocked ? (
              'Test mode: sending logs to the browser console. Use Back to list to return without sending.'
            ) : (
              'After you send, you return to the list hub to pick the next lead or run Send all.'
            )}
          </p>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <LeadCard
              contact={currentLead}
              index={currentLeadIndex + 1}
              total={leads.length}
            />
            <EmailEditor
              email={generatedEmail}
              isLoading={isLoading}
              isSending={isSending}
              onRegenerate={handleRegenerateEmail}
              onSend={handleSendEmail}
              onSkip={handleSkipLead}
              onEmailChange={setGeneratedEmail}
              isLastLead={isLastLead}
              testMode={smartleadSendMocked}
              emailFromApi={emailFromApi}
              usingStaticTemplate={usingStaticTemplate}
              generateError={generateError}
              signatureText={getEmailSignature(
                signatureIdentity.first,
                signatureIdentity.last
              )}
              returnToHubLabels={!previewAllMode}
              previewAllSequential={previewAllMode}
              onNextPreview={handleNextPreviewOnly}
              isLastInPreviewQueue={nextLeadIndexWithEmail(currentLeadIndex) === null}
              previewRank={Math.max(0, leadIndicesWithEmail.indexOf(currentLeadIndex)) + 1}
              previewTotal={leadIndicesWithEmail.length}
              sendToSmartleadBlocked={smartleadDailyCapReached}
              sendToSmartleadBlockedReason={dailyCapBlockedReason}
            />
          </div>
        </>
      )}
    </div>
  )
}
