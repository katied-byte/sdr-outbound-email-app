/**
 * Competitor positioning + Arketa messaging (outbound-safe).
 * General language only — no financials, dollar amounts, percentages, or fees.
 *
 * Battle-card themes are distilled from internal comparison CSVs (Key Takeaways,
 * Integrations, sentiment, pricing context) in `competitor-battle-cards-data.ts`.
 *
 * After editing: restart dev server so API + mocks pick up changes.
 */

import {
  PLATFORM_BATTLE_CARDS,
  type BattleCardPlatformKey,
} from './competitor-battle-cards-data'

export type { BattleCardPlatformKey }

/** Final positioning line from the framework (tone anchor for intros). */
export const arketaPositioningStatement =
  "Behind every successful wellness business is Arketa's combination of software and industry expertise."

/**
 * Phrases the brand avoids in external messaging (do not paraphrase into these).
 * See framework "Language to Avoid" slides.
 */
export const arketaOutboundLanguageAvoid = [
  'all-in-one',
  'all in one',
  'streamline operations',
  'streamlined operations',
  'ops replacement',
  'operations replacement',
  'CRM',
  'supercharge',
  'boost revenue',
  'best in class',
  'say goodbye to',
  'fitness booking software',
  'number one',
  '#1',
  'save time, make money',
  'invaluable',
  'leverage',
  'robust',
  'utilize',
  'core operations',
  'operators',
] as const

export function formatBattleCardForPrompt(key: BattleCardPlatformKey, vendorLabel: string): string {
  const c = PLATFORM_BATTLE_CARDS[key]
  let n = 1
  const parts: string[] = []
  const section = (title: string, items: string[]) => {
    if (items.length === 0) return
    parts.push(title)
    for (const item of items) {
      parts.push(`  ${n}. ${item}`)
      n++
    }
  }
  section('Market / positioning:', c.marketThemes)
  section('Booking and scheduling:', c.productWorkflowThemes)
  section('Payments and back office (qualitative only; never cite numbers):', c.paymentsOpsThemes)
  section('Integrations / stack:', c.integrationThemes)
  return `BATTLE CARD (common friction themes for studios on ${vendorLabel} — for PARAGRAPH A; paraphrase loosely; never quote bullet text; never name review sites, star scores, or rankings; NEVER mention price, dollars, percentages, rates, contract terms, or add-on SKUs):
${parts.join('\n')}

HOW TO USE THIS CARD (align with main email OUTPUT FORMAT + SALES-TEAM SEQUENCE SHAPE):
- **Paragraph A:** Pick **one** primary theme from the battle card. Up to **two short** sentences naming **${vendorLabel}** with **concrete pain** — peer-level ("studios on ${vendorLabel} often…", "we hear from studios using ${vendorLabel} that…" — **rephrase**, do not repeat stock phrases). Not a personal attack. **Optional second sentence:** **You** voice ("You might…", "You're probably trying to…") that fits **only** that friction (day-to-day angle), max ~22 words — **not** a laundry list of tools, manual tracking, spreadsheets, or generic staff/client dissatisfaction.
- **Paragraph B:** **Arketa** as relief — use the ARKETA VALUE MENU; **directly answer** the pain + the "you" beat from A. Concrete, conversational contrast — not a random feature list.`
}

export const competitorPositioning = {
  /**
   * Concrete Arketa differentiators for cold email **paragraph B** (from value pillars
   * + proof points). Rephrase; do not quote. Use "and" or "+" for feature pairs
   * when grouping (avoid ampersands in running copy per brand guide).
   */
  arketaGeneral: [
    'Built by people who taught the classes and opened studios: workflows match how wellness businesses actually run.',
    'A complete business wellness system: software, tools, and industry guidance so you are not piecing together scattered tech.',
    'Beautifully unified: scheduling, retail, and money-side tools built to work together, including broader business workflows in one clean client-facing experience.',
    'White-label, mobile-first: clients see your brand, not a pile of disconnected vendor screens.',
    'Room from solopreneur to super studio: same platform as you add locations and complexity.',
    'Forever innovating: product direction shaped by studios using the product every day.',
    'Diversified revenue support: retreats, online retail, teacher trainings, and digital offers on the same foundation as classes.',
    'Client booking: simple paths to schedule; automations for cancellations and no-shows without manual chasing.',
    'Events and education: workshops, appointments, waitlists, and industry resources without a separate stack for each.',
  ],

  normalizeBookingSoftware(software: string | null | undefined): BattleCardPlatformKey | null {
    if (!software || typeof software !== 'string') return null
    const s = software.toLowerCase().trim()
    if (
      s.includes('mindbody') ||
      /\bmind\s*body\b/.test(s) ||
      /\bmbo\b/.test(s) ||
      /\bmindbody\s*online\b/.test(s)
    ) {
      return 'mindbody'
    }
    if (s.includes('wellness') && s.includes('living')) return 'wellnessliving'
    if (s.includes('marianatek') || s.includes('mariana tek')) return 'marianatek'
    if (s.includes('momence')) return 'momence'
    if (s.includes('walla')) return 'walla'
    if (s.includes('glofox') || s.includes('abc glofox') || s.includes('abc fitness')) return 'glofox'
    if (s.includes('clubready') || s.includes('club ready')) return 'clubready'
    return null
  },
}
