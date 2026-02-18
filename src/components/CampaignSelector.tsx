'use client'

import { SmartleadCampaign } from '@/types'

interface CampaignSelectorProps {
  campaigns: SmartleadCampaign[]
  onSelect: (campaign: SmartleadCampaign) => void
  isLoading: boolean
}

export default function CampaignSelector({ 
  campaigns, 
  onSelect, 
  isLoading 
}: CampaignSelectorProps) {
  if (isLoading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {[1, 2, 3].map(i => (
          <div key={i} className="bg-white rounded-lg border border-gray-200 p-6 animate-pulse">
            <div className="h-5 bg-gray-200 rounded w-3/4 mb-2"></div>
            <div className="h-4 bg-gray-100 rounded w-1/2"></div>
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
          Create a campaign in Smartlead first, then come back here.
        </p>
      </div>
    )
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      {campaigns.map(campaign => (
        <button
          key={campaign.id}
          onClick={() => onSelect(campaign)}
          className="bg-white rounded-lg border border-gray-200 p-6 text-left hover:border-primary-500 hover:shadow-md transition-all group"
        >
          <h3 className="font-semibold text-gray-900 group-hover:text-primary-600">
            {campaign.name}
          </h3>
          {campaign.status && (
            <span className={`inline-block mt-2 px-2 py-1 text-xs rounded-full ${
              campaign.status === 'ACTIVE' 
                ? 'bg-green-100 text-green-800'
                : campaign.status === 'PAUSED'
                ? 'bg-yellow-100 text-yellow-800'
                : 'bg-gray-100 text-gray-800'
            }`}>
              {campaign.status}
            </span>
          )}
        </button>
      ))}
    </div>
  )
}
