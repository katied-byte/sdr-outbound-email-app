'use client'

import { useState, useEffect, useCallback } from 'react'
import { HubSpotContact, HubSpotList, SmartleadCampaign, SmartleadEmailAccount, GeneratedEmail } from '@/types'
import CampaignSelector from './CampaignSelector'
import ListSelector from './ListSelector'
import LeadCard from './LeadCard'
import EmailEditor from './EmailEditor'

interface DashboardClientProps {
  userId: string
  userEmail: string
  firstName: string
  lastName: string
}

type Step = 'select-campaign' | 'select-list' | 'work-leads'

const TEST_MODE = true // Set to false when Smartlead inboxes are ready

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
  lastName 
}: DashboardClientProps) {
  const [step, setStep] = useState<Step>('select-campaign')
  const [campaigns, setCampaigns] = useState<SmartleadCampaign[]>([])
  const [lists, setLists] = useState<HubSpotList[]>([])
  const [userInboxes, setUserInboxes] = useState<SmartleadEmailAccount[]>([])
  const [selectedCampaign, setSelectedCampaign] = useState<SmartleadCampaign | null>(null)
  const [selectedList, setSelectedList] = useState<HubSpotList | null>(null)
  const [leads, setLeads] = useState<HubSpotContact[]>([])
  const [currentLeadIndex, setCurrentLeadIndex] = useState(0)
  const [generatedEmail, setGeneratedEmail] = useState<GeneratedEmail | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [isSending, setIsSending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [sentLeadIds, setSentLeadIds] = useState<Set<string>>(new Set())

  const fetchInitialData = useCallback(async () => {
    setIsLoading(true)
    setError(null)
    try {
      const [campaignsRes, inboxesRes] = await Promise.all([
        fetch('/api/smartlead/campaigns'),
        fetch(`/api/smartlead/inboxes?firstName=${encodeURIComponent(firstName)}&lastName=${encodeURIComponent(lastName)}`),
      ])

      let campaignsData = { campaigns: [] }
      let inboxesData = { inboxes: [] }

      if (campaignsRes.ok) {
        campaignsData = await campaignsRes.json()
      }
      if (inboxesRes.ok) {
        inboxesData = await inboxesRes.json()
      }

      // In test mode, use mock campaigns if none returned
      const loadedCampaigns = campaignsData.campaigns || []
      if (TEST_MODE && loadedCampaigns.length === 0) {
        setCampaigns(MOCK_CAMPAIGNS)
      } else {
        setCampaigns(loadedCampaigns)
      }
      
      setUserInboxes(inboxesData.inboxes || [])
    } catch (err) {
      // In test mode, use mock data even on error
      if (TEST_MODE) {
        setCampaigns(MOCK_CAMPAIGNS)
        setUserInboxes([])
      } else {
        setError(err instanceof Error ? err.message : 'An error occurred')
      }
    } finally {
      setIsLoading(false)
    }
  }, [firstName, lastName])

  // Fetch campaigns and user inboxes on mount
  useEffect(() => {
    fetchInitialData()
  }, [fetchInitialData])

  const handleSelectCampaign = async (campaign: SmartleadCampaign) => {
    setSelectedCampaign(campaign)
    setIsLoading(true)
    setError(null)
    
    try {
      const listsRes = await fetch('/api/hubspot/lists')
      
      if (listsRes.ok) {
        const listsData = await listsRes.json()
        const loadedLists = listsData.lists || []
        if (TEST_MODE && loadedLists.length === 0) {
          setLists(MOCK_LISTS)
        } else {
          setLists(loadedLists)
        }
      } else if (TEST_MODE) {
        // Use mock data in test mode
        setLists(MOCK_LISTS)
      } else {
        throw new Error('Failed to fetch HubSpot lists')
      }
      
      setStep('select-list')
    } catch (err) {
      if (TEST_MODE) {
        setLists(MOCK_LISTS)
        setStep('select-list')
      } else {
        setError(err instanceof Error ? err.message : 'An error occurred')
      }
    } finally {
      setIsLoading(false)
    }
  }

  const handleSelectList = async (list: HubSpotList) => {
    setSelectedList(list)
    setIsLoading(true)
    setError(null)

    try {
      const leadsRes = await fetch(`/api/hubspot/lists/${list.listId}/contacts`)
      
      let contacts: HubSpotContact[] = []
      
      if (leadsRes.ok) {
        const leadsData = await leadsRes.json()
        contacts = leadsData.contacts || []
      }
      
      // Use mock contacts in test mode if none returned
      if (TEST_MODE && contacts.length === 0) {
        contacts = MOCK_CONTACTS
      }
      
      setLeads(contacts)
      setCurrentLeadIndex(0)
      setStep('work-leads')

      // Generate email for first lead
      if (contacts.length > 0) {
        await generateEmailForLead(contacts[0])
      }
    } catch (err) {
      if (TEST_MODE) {
        // Use mock data in test mode
        setLeads(MOCK_CONTACTS)
        setCurrentLeadIndex(0)
        setStep('work-leads')
        await generateEmailForLead(MOCK_CONTACTS[0])
      } else {
        setError(err instanceof Error ? err.message : 'An error occurred')
      }
    } finally {
      setIsLoading(false)
    }
  }

  const generateEmailForLead = async (lead: HubSpotContact) => {
    setIsLoading(true)
    setGeneratedEmail(null)
    
    try {
      const res = await fetch('/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          contact: lead,
          campaignName: selectedCampaign?.name 
        }),
      })

      if (!res.ok) throw new Error('Failed to generate email')

      const data = await res.json()
      setGeneratedEmail(data.email)
    } catch (err) {
      if (TEST_MODE) {
        // Generate a mock email in test mode
        const company = lead.company?.properties
        const mockIntro = company 
          ? `I noticed ${company.name} in ${company.city || 'your area'} has been doing great work${company.gmaps_ratings ? ` - ${company.gmaps_ratings} stars with ${company.gmaps_reviews} reviews is impressive!` : '.'} I wanted to reach out because I think we could help you grow even further.`
          : `I came across your profile and was impressed by your work as ${lead.properties.jobtitle || 'a leader'} in the fitness industry. I wanted to reach out because I think we could help you achieve your goals.`
        
        setGeneratedEmail({
          subject: `Quick question for ${lead.properties.firstname || 'you'}`,
          personalizedIntro: mockIntro,
          fullBody: `Hi ${lead.properties.firstname || 'there'},\n\n${mockIntro}\n\n[Rest of campaign template...]\n\n%signature%`
        })
      } else {
        setError(err instanceof Error ? err.message : 'Failed to generate email')
      }
    } finally {
      setIsLoading(false)
    }
  }

  const handleRegenerateEmail = async () => {
    if (leads[currentLeadIndex]) {
      await generateEmailForLead(leads[currentLeadIndex])
    }
  }

  const handleSendEmail = async () => {
    if (!selectedCampaign || !generatedEmail || !leads[currentLeadIndex]) return

    setIsSending(true)
    setError(null)

    try {
      const lead = leads[currentLeadIndex]
      
      if (TEST_MODE) {
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
            inboxIds: userInboxes.map(i => i.id),
          }),
        })

        if (!res.ok) throw new Error('Failed to send email')
      }

      // Mark lead as sent and move to next
      setSentLeadIds(prev => new Set(prev).add(lead.id))
      
      if (currentLeadIndex < leads.length - 1) {
        const nextIndex = currentLeadIndex + 1
        setCurrentLeadIndex(nextIndex)
        setGeneratedEmail(null)
        await generateEmailForLead(leads[nextIndex])
      } else {
        // All leads done
        setGeneratedEmail(null)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to send email')
    } finally {
      setIsSending(false)
    }
  }

  const handleSkipLead = async () => {
    if (currentLeadIndex < leads.length - 1) {
      const nextIndex = currentLeadIndex + 1
      setCurrentLeadIndex(nextIndex)
      setGeneratedEmail(null)
      await generateEmailForLead(leads[nextIndex])
    }
  }

  const handleBack = () => {
    if (step === 'select-list') {
      setStep('select-campaign')
      setSelectedCampaign(null)
    } else if (step === 'work-leads') {
      setStep('select-list')
      setSelectedList(null)
      setLeads([])
      setCurrentLeadIndex(0)
      setGeneratedEmail(null)
    }
  }

  const currentLead = leads[currentLeadIndex]
  const remainingLeads = leads.length - currentLeadIndex
  const isLastLead = currentLeadIndex === leads.length - 1

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
            {step === 'work-leads' && 'Personalize Emails'}
          </h1>
          {selectedCampaign && (
            <p className="text-sm text-gray-500 mt-1">
              Campaign: {selectedCampaign.name}
              {selectedList && ` • List: ${selectedList.name}`}
              {step === 'work-leads' && ` • ${remainingLeads} leads remaining`}
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

      {/* User inboxes info */}
      {userInboxes.length > 0 && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <p className="text-sm text-blue-800">
            <span className="font-medium">Your sending inboxes:</span>{' '}
            {userInboxes.map(i => i.email).join(', ')}
          </p>
        </div>
      )}

      {userInboxes.length === 0 && !isLoading && (
        <div className={`${TEST_MODE ? 'bg-purple-50 border-purple-200' : 'bg-yellow-50 border-yellow-200'} border rounded-lg p-4`}>
          <p className={`text-sm ${TEST_MODE ? 'text-purple-800' : 'text-yellow-800'}`}>
            {TEST_MODE ? (
              <>
                <span className="font-medium">TEST MODE ENABLED</span> - No Smartlead inboxes needed. 
                Emails will be previewed but not actually sent.
              </>
            ) : (
              <>
                No Smartlead inboxes found matching your name ({firstName} {lastName}). 
                Contact your admin to set up your email accounts.
              </>
            )}
          </p>
        </div>
      )}

      {/* Error display */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <p className="text-sm text-red-800">{error}</p>
        </div>
      )}

      {/* Step content */}
      {step === 'select-campaign' && (
        <CampaignSelector
          campaigns={campaigns}
          onSelect={handleSelectCampaign}
          isLoading={isLoading}
        />
      )}

      {step === 'select-list' && (
        <ListSelector
          lists={lists}
          onSelect={handleSelectList}
          isLoading={isLoading}
        />
      )}

      {step === 'work-leads' && currentLead && (
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
            testMode={TEST_MODE}
          />
        </div>
      )}

      {step === 'work-leads' && !currentLead && leads.length === 0 && !isLoading && (
        <div className="text-center py-12">
          <p className="text-gray-500">No contacts found in this list.</p>
        </div>
      )}

      {step === 'work-leads' && sentLeadIds.size === leads.length && leads.length > 0 && (
        <div className="text-center py-12 bg-green-50 rounded-lg">
          <h2 className="text-xl font-semibold text-green-800 mb-2">All done!</h2>
          <p className="text-green-600">
            You&apos;ve sent personalized emails to all {leads.length} leads in this list.
          </p>
          <button
            onClick={() => setStep('select-campaign')}
            className="mt-4 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
          >
            Start New Campaign
          </button>
        </div>
      )}
    </div>
  )
}
