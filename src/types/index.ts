// HubSpot Types
export interface HubSpotCallNote {
  id: string
  date: string        // ISO date string of the call
  notes: string       // Body / description of the call
  direction?: string  // e.g. "INBOUND" | "OUTBOUND"
  duration?: number   // seconds
  disposition?: string // e.g. "CONNECTED", "LEFT_VOICEMAIL"
}

export interface HubSpotContact {
  id: string
  properties: {
    firstname: string | null
    lastname: string | null
    jobtitle: string | null
    email: string | null
    /** Primary company association (HubSpot internal); fastest path to company record */
    associatedcompanyid?: string | null
    /** Booking stack may live on contact if not synced to company */
    promptloop_booking_software?: string | null
    booking_software?: string | null
    booking_platform?: string | null
  }
  company?: HubSpotCompany
  lastCall?: HubSpotCallNote  // Most recent call from HubSpot engagements
  /** Concatenated CRM timeline note bodies (when fetched for booking detection; not a HubSpot property) */
  hubspotCrmNotesText?: string
}

export interface HubSpotCompany {
  id: string
  properties: {
    name: string | null
    domain: string | null
    city: string | null
    state: string | null
    // Custom properties - these may need adjustment based on your actual HubSpot property names
    gtm_modality?: string | null
    promptloop_modalities?: string | null
    promptloop_booking_software?: string | null
    /** Alternate HubSpot internal names for the same field */
    booking_software?: string | null
    booking_platform?: string | null
    promptloop_number_of_locations?: string | null
    promptloop_avg_daily_class_count?: string | null
    promptloop_staff_count_website?: string | null
    promptloop_staff_count_booking_page?: string | null
    gmaps_ratings?: string | null
    gmaps_reviews?: string | null
  }
}

export interface HubSpotList {
  listId: number
  name: string
  listType: string
  createdAt: string
  updatedAt: string
}

// Smartlead Types
export interface SmartleadCampaign {
  id: number
  name: string
  status?: string
  client_id?: number
  created_at?: string
}

export interface SmartleadEmailAccount {
  id: number
  email: string
  domain?: string
  client_id?: number
  message_per_day?: number
  max_email_per_day?: number
  provider?: string
  from_name?: string
  warmup_enabled?: boolean
}

export interface SmartleadSequence {
  seq_number: number
  subject: string
  email_body: string
  seq_delay_details?: {
    delay_in_days: number
  }
  sequence_variants?: SmartleadVariant[]
}

export interface SmartleadVariant {
  id?: number
  subject: string
  email_body: string
  variant_label: string
}

// App Types
export interface User {
  id: string
  email: string
  full_name: string
  smartlead_inbox_ids: number[]
  created_at: string
}

export interface SentEmail {
  id: string
  user_id: string
  hubspot_contact_id: string
  hubspot_contact_email: string
  smartlead_campaign_id: number
  smartlead_campaign_name: string
  subject: string
  personalized_intro: string
  sent_at: string
}

// Lead with enriched data for the UI
export interface EnrichedLead {
  contact: HubSpotContact
  company: HubSpotCompany | null
  sentCampaigns: number[] // Campaign IDs this lead has already received
}

// Email generation
export interface GeneratedEmail {
  subject: string
  personalizedIntro: string
  fullBody: string
}
