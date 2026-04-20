import type { SmartleadCampaign } from '@/types'

function hasCampaignShape(x: unknown): x is SmartleadCampaign {
  if (!x || typeof x !== 'object') return false
  const o = x as Record<string, unknown>
  if (typeof o.name !== 'string') return false
  const id = o.id
  return typeof id === 'number' || (typeof id === 'string' && id.trim() !== '')
}

function finalizeCampaigns(rows: unknown[]): SmartleadCampaign[] {
  const out: SmartleadCampaign[] = []
  for (const x of rows) {
    if (!hasCampaignShape(x)) continue
    const o = x as SmartleadCampaign
    const id = typeof o.id === 'number' ? o.id : parseInt(String(o.id), 10)
    if (!Number.isFinite(id)) continue
    out.push({ ...o, id, name: String(o.name) })
  }
  return out
}

/**
 * Normalizes Smartlead GET /campaigns/ JSON — shape varies (array, { campaigns }, agency wrappers).
 */
export function parseSmartleadCampaignListJson(json: unknown): SmartleadCampaign[] {
  if (!json) return []
  if (Array.isArray(json)) {
    return finalizeCampaigns(json)
  }
  if (typeof json !== 'object') return []

  const root = json as Record<string, unknown>

  if (typeof root.error === 'string') {
    return []
  }

  const tryArrays = [
    root.campaigns,
    root.data,
    root.results,
    root.campaign_list,
    root.items,
  ]

  for (const v of tryArrays) {
    if (Array.isArray(v) && v.length > 0 && hasCampaignShape(v[0])) {
      return finalizeCampaigns(v)
    }
  }

  if (root.data && typeof root.data === 'object' && !Array.isArray(root.data)) {
    const inner = (root.data as Record<string, unknown>).campaigns
    if (Array.isArray(inner) && inner.length > 0 && hasCampaignShape(inner[0])) {
      return finalizeCampaigns(inner)
    }
  }

  if (Array.isArray(root.data) && root.data.length > 0 && hasCampaignShape(root.data[0])) {
    return finalizeCampaigns(root.data)
  }

  return []
}
