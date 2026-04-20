'use client'

import { useMemo, useState } from 'react'
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
  const [query, setQuery] = useState('')

  const filteredLists = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return lists
    return lists.filter(
      list =>
        list.name.toLowerCase().includes(q) ||
        String(list.listId).includes(q)
    )
  }, [lists, query])

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
    <div className="space-y-4">
      <div className="relative">
        <label htmlFor="hubspot-list-search" className="sr-only">
          Search HubSpot lists
        </label>
        <span
          className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-gray-400"
          aria-hidden
        >
          <svg
            className="h-5 w-5"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
            />
          </svg>
        </span>
        <input
          id="hubspot-list-search"
          type="search"
          value={query}
          onChange={e => setQuery(e.target.value)}
          placeholder="Search lists by name or ID…"
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

      {filteredLists.length === 0 ? (
        <div className="text-center py-10 bg-white rounded-lg border border-dashed border-gray-200">
          <p className="text-gray-600">No lists match &ldquo;{query.trim()}&rdquo;.</p>
          <p className="text-sm text-gray-400 mt-1">
            Try another name or list ID, or clear the search.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredLists.map(list => (
            <button
              type="button"
              key={list.listId}
              onClick={e => {
                e.preventDefault()
                onSelect(list)
              }}
              className="bg-white rounded-lg border border-gray-200 p-6 text-left hover:border-primary-500 hover:shadow-md transition-all cursor-pointer group"
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
      )}
    </div>
  )
}
