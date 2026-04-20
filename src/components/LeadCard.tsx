'use client'

import { HubSpotContact } from '@/types'
import { resolveBookingSoftwareForContact } from '@/lib/booking-software'

interface LeadCardProps {
  contact: HubSpotContact
  index: number
  total: number
}

export default function LeadCard({ contact, index, total }: LeadCardProps) {
  const { properties } = contact
  const company = contact.company?.properties
  const resolvedBooking = resolveBookingSoftwareForContact(contact)

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold text-gray-900">Lead Info</h2>
        <span className="text-sm text-gray-500">
          {index} of {total}
        </span>
      </div>

      {/* Contact Info */}
      <div className="mb-6">
        <h3 className="text-sm font-medium text-gray-500 uppercase tracking-wide mb-3">
          Contact
        </h3>
        <div className="space-y-2">
          <div>
            <span className="text-lg font-medium text-gray-900">
              {properties.firstname || ''} {properties.lastname || ''}
            </span>
          </div>
          {properties.jobtitle && (
            <div className="text-sm text-gray-600">{properties.jobtitle}</div>
          )}
          {properties.email && (
            <div className="text-sm text-gray-500">{properties.email}</div>
          )}
          {resolvedBooking && (
            <div className="pt-2">
              <div className="text-xs text-gray-500 uppercase tracking-wide">Booking software</div>
              <div className="text-sm font-medium text-gray-900">{resolvedBooking}</div>
            </div>
          )}
        </div>
      </div>

      {/* Company Info */}
      {company && (
        <div>
          <h3 className="text-sm font-medium text-gray-500 uppercase tracking-wide mb-3">
            Company
          </h3>
          <div className="space-y-3">
            {company.name && (
              <div>
                <span className="font-medium text-gray-900">{company.name}</span>
                {company.domain && (
                  <a 
                    href={`https://${company.domain}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="ml-2 text-sm text-primary-600 hover:underline"
                  >
                    {company.domain}
                  </a>
                )}
              </div>
            )}
            
            {(company.city || company.state) && (
              <div className="text-sm text-gray-600">
                {[company.city, company.state].filter(Boolean).join(', ')}
              </div>
            )}

            {/* Custom Properties Grid */}
            <div className="grid grid-cols-2 gap-3 pt-3 border-t border-gray-100">
              {company.gtm_modality && (
                <PropertyItem label="GTM Modality" value={company.gtm_modality} />
              )}
              {company.promptloop_modalities && (
                <PropertyItem label="Business Type" value={company.promptloop_modalities} />
              )}
              {company.promptloop_number_of_locations && (
                <PropertyItem label="Locations" value={company.promptloop_number_of_locations} />
              )}
              {company.promptloop_avg_daily_class_count && (
                <PropertyItem label="Avg Daily Classes" value={company.promptloop_avg_daily_class_count} />
              )}
              {company.promptloop_staff_count_website && (
                <PropertyItem label="Staff (Website)" value={company.promptloop_staff_count_website} />
              )}
              {company.promptloop_staff_count_booking_page && (
                <PropertyItem label="Staff (Booking)" value={company.promptloop_staff_count_booking_page} />
              )}
              {company.gmaps_ratings && (
                <PropertyItem 
                  label="Google Rating" 
                  value={`${company.gmaps_ratings}★`}
                  highlight
                />
              )}
              {company.gmaps_reviews && (
                <PropertyItem 
                  label="Reviews" 
                  value={company.gmaps_reviews}
                />
              )}
            </div>
          </div>
        </div>
      )}

      {!company && (
        <div className="text-sm text-gray-400 italic">
          No company data available
        </div>
      )}

      {/* Last Call */}
      {contact.lastCall ? (
        <div className="mt-6 pt-5 border-t border-gray-100">
          <h3 className="text-sm font-medium text-gray-500 uppercase tracking-wide mb-3">
            Last Call
          </h3>
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-sm text-gray-600">
              <span className="font-medium text-gray-900">
                {new Date(contact.lastCall.date).toLocaleDateString('en-US', {
                  year: 'numeric',
                  month: 'long',
                  day: 'numeric',
                })}
              </span>
              {contact.lastCall.disposition && (
                <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">
                  {contact.lastCall.disposition.replace(/_/g, ' ')}
                </span>
              )}
            </div>
            {contact.lastCall.notes ? (
              <p className="text-sm text-gray-700 bg-amber-50 border border-amber-100 rounded-lg p-3 whitespace-pre-wrap">
                {contact.lastCall.notes}
              </p>
            ) : (
              <p className="text-sm text-gray-400 italic">No notes recorded for this call.</p>
            )}
          </div>
        </div>
      ) : (
        <div className="mt-6 pt-5 border-t border-gray-100">
          <h3 className="text-sm font-medium text-gray-500 uppercase tracking-wide mb-1">
            Last Call
          </h3>
          <p className="text-sm text-gray-400 italic">No previous calls found in HubSpot.</p>
        </div>
      )}
    </div>
  )
}

function PropertyItem({ 
  label, 
  value, 
  highlight = false 
}: { 
  label: string
  value: string
  highlight?: boolean 
}) {
  return (
    <div>
      <div className="text-xs text-gray-500">{label}</div>
      <div className={`text-sm ${highlight ? 'text-amber-600 font-medium' : 'text-gray-900'}`}>
        {value}
      </div>
    </div>
  )
}
