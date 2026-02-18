import { HubSpotContact, HubSpotCompany, HubSpotList } from '@/types'

const HUBSPOT_API_BASE = 'https://api.hubapi.com'

async function hubspotFetch(endpoint: string, options: RequestInit = {}) {
  const response = await fetch(`${HUBSPOT_API_BASE}${endpoint}`, {
    ...options,
    headers: {
      'Authorization': `Bearer ${process.env.HUBSPOT_ACCESS_TOKEN}`,
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
  'associatedcompanyid',
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
  'promptloop_number_of_locations',
  'promptloop_avg_daily_class_count',
  'promptloop_staff_count_website',
  'promptloop_staff_count_booking_page',
  'gmaps_ratings',
  'gmaps_reviews',
]

export async function getLists(): Promise<HubSpotList[]> {
  const data = await hubspotFetch('/crm/v3/lists')
  return data.lists || []
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

  const data = await hubspotFetch('/crm/v3/objects/contacts/batch/read', {
    method: 'POST',
    body: JSON.stringify({
      properties: CONTACT_PROPERTIES,
      inputs: ids.map(id => ({ id })),
    }),
  })

  return data.results || []
}

export async function getCompany(companyId: string): Promise<HubSpotCompany | null> {
  try {
    const data = await hubspotFetch(
      `/crm/v3/objects/companies/${companyId}?properties=${COMPANY_PROPERTIES.join(',')}`
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

    // Get the first associated company
    const companyId = associations.results[0].id
    return getCompany(companyId)
  } catch {
    return null
  }
}

export async function enrichContactWithCompany(contact: HubSpotContact): Promise<HubSpotContact> {
  const company = await getCompanyByContactId(contact.id)
  return {
    ...contact,
    company: company || undefined,
  }
}

export async function enrichContactsWithCompanies(contacts: HubSpotContact[]): Promise<HubSpotContact[]> {
  const enrichedContacts = await Promise.all(
    contacts.map(contact => enrichContactWithCompany(contact))
  )
  return enrichedContacts
}
