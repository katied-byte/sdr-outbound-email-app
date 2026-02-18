'use client'

import { HubSpotContact } from '@/types'

interface LeadCardProps {
  contact: HubSpotContact
  index: number
  total: number
}

export default function LeadCard({ contact, index, total }: LeadCardProps) {
  const { properties } = contact
  const company = contact.company?.properties

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
              {company.promptloop_booking_software && (
                <PropertyItem label="Booking Software" value={company.promptloop_booking_software} />
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
