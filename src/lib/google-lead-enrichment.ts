/**
 * Optional public-web context for email personalization (Google APIs).
 * All keys optional; if unset, returns empty string and generation skips this block.
 *
 * - GOOGLE_PLACES_API_KEY: Places API (Find Place + Place Details) for rating / review count.
 * - GOOGLE_CUSTOM_SEARCH_API_KEY + GOOGLE_CUSTOM_SEARCH_ENGINE_ID: Programmable Search for recent web/news snippets.
 *
 * Enable Places + Custom Search in Google Cloud; Custom Search needs a Programmable Search Engine (can search whole web).
 */

export type GoogleEnrichmentInput = {
  companyName?: string | null
  city?: string | null
  state?: string | null
  domain?: string | null
}

function placesKey(): string | undefined {
  return process.env.GOOGLE_PLACES_API_KEY?.trim() || undefined
}

function customSearchKeys(): { key: string; cx: string } | null {
  const key = process.env.GOOGLE_CUSTOM_SEARCH_API_KEY?.trim()
  const cx = process.env.GOOGLE_CUSTOM_SEARCH_ENGINE_ID?.trim()
  if (!key || !cx) return null
  return { key, cx }
}

/** Find Place + Details (legacy Places API, widely enabled). */
async function fetchPlacesSummary(input: GoogleEnrichmentInput): Promise<string | null> {
  const apiKey = placesKey()
  if (!apiKey) return null

  const name = input.companyName?.trim()
  if (!name) return null

  const loc = [input.city, input.state].filter(Boolean).join(', ')
  const query = [name, loc, input.domain?.trim()].filter(Boolean).join(' ')

  const findUrl = new URL('https://maps.googleapis.com/maps/api/place/findplacefromtext/json')
  findUrl.searchParams.set('input', query)
  findUrl.searchParams.set('inputtype', 'textquery')
  findUrl.searchParams.set('fields', 'place_id,rating,user_ratings_total,business_status')
  findUrl.searchParams.set('key', apiKey)

  const findRes = await fetch(findUrl.toString(), { cache: 'no-store' })
  const findJson = (await findRes.json().catch(() => ({}))) as {
    status?: string
    candidates?: { place_id?: string; rating?: number; user_ratings_total?: number }[]
  }

  if (findJson.status !== 'OK' || !findJson.candidates?.length) return null

  const c0 = findJson.candidates[0]
  const placeId = c0.place_id
  let rating = c0.rating
  let total = c0.user_ratings_total

  if (placeId) {
    const detUrl = new URL('https://maps.googleapis.com/maps/api/place/details/json')
    detUrl.searchParams.set('place_id', placeId)
    detUrl.searchParams.set(
      'fields',
      'name,rating,user_ratings_total,editorial_summary,url'
    )
    detUrl.searchParams.set('key', apiKey)
    const detRes = await fetch(detUrl.toString(), { cache: 'no-store' })
    const detJson = (await detRes.json().catch(() => ({}))) as {
      status?: string
      result?: {
        name?: string
        rating?: number
        user_ratings_total?: number
        editorial_summary?: { overview?: string }
        url?: string
      }
    }
    if (detJson.status === 'OK' && detJson.result) {
      const r = detJson.result
      rating = r.rating ?? rating
      total = r.user_ratings_total ?? total
      const parts: string[] = []
      if (rating != null && total != null) {
        parts.push(`Google Maps: about ${rating} stars from roughly ${total} public reviews`)
      } else if (rating != null) {
        parts.push(`Google Maps: about ${rating} stars (public listing)`)
      }
      const overview = r.editorial_summary?.overview?.trim()
      if (overview) {
        const short = overview.length > 220 ? `${overview.slice(0, 217)}...` : overview
        parts.push(`Google listing summary: ${short}`)
      }
      return parts.length ? parts.join('. ') + '.' : null
    }
  }

  if (rating != null && total != null) {
    return `Google Maps: about ${rating} stars from roughly ${total} public reviews.`
  }
  return null
}

/** Programmable Search: a few recent-ish results (titles + snippets). */
async function fetchSearchSnippets(input: GoogleEnrichmentInput): Promise<string | null> {
  const keys = customSearchKeys()
  if (!keys) return null

  const name = input.companyName?.trim()
  if (!name) return null

  const q = `"${name}" ${input.city || ''} ${input.state || ''} fitness OR studio OR gym OR wellness`.replace(
    /\s+/g,
    ' '
  )

  const url = new URL('https://www.googleapis.com/customsearch/v1')
  url.searchParams.set('key', keys.key)
  url.searchParams.set('cx', keys.cx)
  url.searchParams.set('q', q.trim())
  url.searchParams.set('num', '4')
  url.searchParams.set('dateRestrict', 'y1')

  const res = await fetch(url.toString(), { cache: 'no-store' })
  const data = (await res.json().catch(() => ({}))) as {
    items?: { title?: string; snippet?: string; link?: string }[]
    error?: { message?: string }
  }

  if (!data.items?.length) return null

  const lines = data.items
    .slice(0, 4)
    .map((it) => {
      const t = (it.title || '').trim()
      const s = (it.snippet || '').trim()
      if (!t && !s) return ''
      if (!s) return t
      const sn = s.length > 160 ? `${s.slice(0, 157)}...` : s
      return `${t}: ${sn}`
    })
    .filter(Boolean)

  if (!lines.length) return null
  return `Recent web mentions (search, not verified): ${lines.join(' | ')}`
}

/**
 * Plain-text facts for the model. Empty if no API keys or no usable results.
 */
export async function enrichLeadFromGoogle(input: GoogleEnrichmentInput): Promise<string> {
  try {
    const [places, search] = await Promise.all([
      fetchPlacesSummary(input),
      fetchSearchSnippets(input),
    ])
    const bits = [places, search].filter(Boolean)
    return bits.join('\n')
  } catch (e) {
    if (process.env.NODE_ENV === 'development') {
      console.warn('[google-enrichment]', e)
    }
    return ''
  }
}
