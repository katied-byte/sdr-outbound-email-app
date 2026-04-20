'use client'

import { useMemo, useState } from 'react'
import { SmartleadCampaign } from '@/types'

interface CampaignSelectorProps {
  campaigns: SmartleadCampaign[]
  onSelect: (campaign: SmartleadCampaign) => void
  isLoading: boolean
  liveMode?: boolean
}

export default function CampaignSelector({
  campaigns,
  onSelect,
  isLoading,
  liveMode = false,
}: CampaignSelectorProps) {
  const [query, setQuery] = useState('')

  const filteredCampaigns = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return campaigns
    return campaigns.filter((c) => {
      const name = (c.name || '').toLowerCase()
      const status = (c.status || '').toLowerCase()
      return (
        name.includes(q) ||
        status.includes(q) ||
        String(c.id).includes(q)
      )
    })
  }, [campaigns, query])

  // Only skeleton when we truly have nothing to show yet (avoids infinite skeleton if API hangs)
  if (isLoading && campaigns.length === 0) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {[1, 2, 3].map((i) => (
          <div key={i} className="bg-white rounded-lg border border-gray-200 p-6 animate-pulse">
            <div className="h-5 bg-gray-200 rounded w-3/4 mb-2" />
            <div className="h-4 bg-gray-100 rounded w-1/2" />
          </div>
        ))}
      </div>
    )
  }

  if (campaigns.length === 0) {
    return (
      <div className="text-center py-12 bg-white rounded-lg border border-gray-200">
        <p className="text-gray-500">No campaigns found in Smartlead.</p>
        <p className="text-sm text-gray-400 mt-1">
          Create a campaign in Smartlead, confirm your API key in <code className="text-xs bg-gray-100 px-1 rounded">.env.local</code>, then refresh.
        </p>
        {!liveMode && (
          <p className="text-sm text-gray-400 mt-2">
            Or set <code className="text-xs bg-gray-100 px-1 rounded">NEXT_PUBLIC_LIVE_OUTBOUND=false</code> in{' '}
            <code className="text-xs bg-gray-100 px-1 rounded">.env.local</code> to use demo campaigns without
            Smartlead.
          </p>
        )}
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="relative">
        <label htmlFor="smartlead-campaign-search" className="sr-only">
          Search Smartlead campaigns
        </label>
        <span
          className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-gray-400"
          aria-hidden
        >
          <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
            />
          </svg>
        </span>
        <input
          id="smartlead-campaign-search"
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search campaigns by name, status, or ID…"
          autoComplete="off"
          className="w-full rounded-lg border border-gray-300 bg-white py-2.5 pl-10 pr-10 text-sm text-gray-900 placeholder:text-gray-400 shadow-sm focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/20"
        />
        {query ? (
          <button
            type="button"
            onClick={() => setQuery('')}
            className="absolute inset-y-0 right-0 flex items-center pr-3 text-sm text-gray-500 hover:text-gray-800"
            aria-label="Clear search"
          >
            Clear
          </button>
        ) : null}
      </div>

      {filteredCampaigns.length === 0 ? (
        <div className="text-center py-10 bg-white rounded-lg border border-dashed border-gray-200">
          <p className="text-gray-600">No campaigns match &ldquo;{query.trim()}&rdquo;.</p>
          <p className="text-sm text-gray-400 mt-1">
            Try another name, status, or ID, or clear the search.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredCampaigns.map((campaign) => (
            <button
              type="button"
              key={campaign.id}
              onClick={(e) => {
                e.preventDefault()
                onSelect(campaign)
              }}
              className="bg-white rounded-lg border border-gray-200 p-6 text-left hover:border-primary-500 hover:shadow-md transition-all cursor-pointer group"
            >
              <h3 className="font-semibold text-gray-900 group-hover:text-primary-600">{campaign.name}</h3>
              {campaign.status && (
                <span
                  className={`inline-block mt-2 px-2 py-1 text-xs rounded-full ${
                    campaign.status === 'ACTIVE'
                      ? 'bg-green-100 text-green-800'
                      : campaign.status === 'PAUSED'
                        ? 'bg-yellow-100 text-yellow-800'
                        : 'bg-gray-100 text-gray-800'
                  }`}
                >
                  {campaign.status}
                </span>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
