'use client'

import { HubSpotList } from '@/types'

interface ListSelectorProps {
  lists: HubSpotList[]
  onSelect: (list: HubSpotList) => void
  isLoading: boolean
}

export default function ListSelector({ 
  lists, 
  onSelect, 
  isLoading 
}: ListSelectorProps) {
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

  if (lists.length === 0) {
    return (
      <div className="text-center py-12 bg-white rounded-lg border border-gray-200">
        <p className="text-gray-500">No lists found in HubSpot.</p>
        <p className="text-sm text-gray-400 mt-1">
          Create a list in HubSpot first, then come back here.
        </p>
      </div>
    )
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      {lists.map(list => (
        <button
          key={list.listId}
          onClick={() => onSelect(list)}
          className="bg-white rounded-lg border border-gray-200 p-6 text-left hover:border-primary-500 hover:shadow-md transition-all group"
        >
          <h3 className="font-semibold text-gray-900 group-hover:text-primary-600">
            {list.name}
          </h3>
          <p className="text-sm text-gray-500 mt-1">
            {list.listType === 'DYNAMIC' ? 'Active list' : 'Static list'}
          </p>
        </button>
      ))}
    </div>
  )
}
