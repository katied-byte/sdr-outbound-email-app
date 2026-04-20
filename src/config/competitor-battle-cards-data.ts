/**
 * Condensed from internal competitor comparison CSVs (Key Takeaways, Integrations,
 * sentiment index, pricing sheet — pricing NUMBERS are intentionally omitted here;
 * never surface dollars, %, or named tiers in outbound copy).
 *
 * HubSpot company field label: "Promptloop - Booking Software" → internal name
 * `promptloop_booking_software` (already requested in hubspot.ts).
 */

export type BattleCardPlatformKey =
  | 'mindbody'
  | 'wellnessliving'
  | 'marianatek'
  | 'momence'
  | 'walla'
  | 'glofox'
  | 'clubready'

export type PlatformBattleCard = {
  /** Buyer / market chatter (Key Takeaways summary row) */
  marketThemes: string[]
  /** Booking, scheduling, waivers, waitlists (Key Takeaways “Booking & scheduling” row) */
  productWorkflowThemes: string[]
  /** Payments & back office — qualitative only (Key Takeaways Payments + Pricing themes, no figures) */
  paymentsOpsThemes: string[]
  /** Stack / ecosystem (Integrations CSV), vague where sensitive */
  integrationThemes: string[]
}

export const PLATFORM_BATTLE_CARDS: Record<BattleCardPlatformKey, PlatformBattleCard> = {
  mindbody: {
    marketThemes: [
      'Widely described as the legacy category leader with very broad capability, but many studios call the day-to-day experience clunky or dated.',
      'Breadth of features is a strength; fit-and-finish plus change velocity are common discussion points with growing studios.',
    ],
    productWorkflowThemes: [
      'Strong coverage for classes, appointments, and multi-service businesses; recurring feedback that admin workflows and templates can feel heavy to run.',
      'Guest booking exists; some boutique teams want stronger waiver capture than checkbox-only flows when risk matters.',
    ],
    paymentsOpsThemes: [
      'No-show and late-cancel enforcement is often described as more manual back-office work than policy-driven automation with card-on-file settlement.',
      'Many accounts run on the vendor’s own payments story; total cost transparency is a recurring evaluation topic (stay qualitative, never cite rates).',
    ],
    integrationThemes: [
      'Google Business and third-party discovery paths exist; some marketplace-style booking routes add partner economics studios should model (never quote percentages).',
      'Spivi and hardware metrics are often accessed through the consumer app experience.',
    ],
  },
  wellnessliving: {
    marketThemes: [
      'Often positioned as a value alternative; support responsiveness and navigation are recurring themes in peer conversations.',
      'Feature-rich positioning with UI density called out — busy screens and learning curve versus simpler boutique tools.',
    ],
    productWorkflowThemes: [
      'Handles classes, appointments, and events; calendar works but feels cluttered to some teams; booking rules can get complex.',
      'Waitlists exist; automation depth is often compared unfavorably to more boutique-first schedulers.',
    ],
    paymentsOpsThemes: [
      'May run on proprietary payments or Stripe; partners talk about layered costs and who absorbs processing — keep any mention non-numeric.',
      'ACH and ancillary payment features sometimes carry opaque fee stories in evaluations.',
    ],
    integrationThemes: [
      'Door access tools such as Kisi may flow through middleware automation; immediacy and maintenance differ from native access sync.',
      'Spivi metrics often live in the vendor’s Achieve or branded app experience.',
    ],
  },
  marianatek: {
    marketThemes: [
      'Reputation skews enterprise and multi-location franchise; independents may feel the interface and ramp are heavier than class-only boutique tools.',
      'Innovation cadence and ownership changes show up in diligence conversations alongside roadmap questions.',
    ],
    productWorkflowThemes: [
      'Strong for high-volume class grids; appointments and broader events have been a slower roadmap story for some studios.',
      'Waitlists and hybrid models can require more manual steering than studios want at scale.',
      'Digital delivery gaps (native video/PDF style offerings for education series) matter to teams that monetize trainings.',
    ],
    paymentsOpsThemes: [
      'Often Stripe-backed; partners still scrutinize how processing and packaging roll into total cost (no numbers in email).',
      'International payment breadth varies by account setup.',
    ],
    integrationThemes: [
      'Spivi and member-app paths are commonly tied to the same login story as the core account.',
    ],
  },
  momence: {
    marketThemes: [
      'Seen as modern and startup-adjacent; support load, add-on surface area, and transaction economics are frequent evaluation topics (qualitative only).',
      'Y Combinator-era story shows up in competitive chatter; treat as context, not a pitch wedge.',
    ],
    productWorkflowThemes: [
      'Clean scheduling for classes and workshops; lighter appointment depth for hybrid studios that live in privates and events.',
      'Waitlist tooling described as basic versus automation-first competitors.',
      'Guest booking exists; waiver handling skews checkbox-simple where some owners want signature-grade capture.',
    ],
    paymentsOpsThemes: [
      'Typically Stripe-backed; international breadth is narrower for some cross-border studios.',
    ],
    integrationThemes: [
      'Kisi-style access integrations exist; compare reliability to native door permission sync if 24/7 access is core.',
      'Classpass-style marketplace integrations are supported for group classes where that channel matters.',
    ],
  },
  walla: {
    marketThemes: [
      'Praised for a cleaner interface; smaller installed base means migration narratives and occasional stability chatter surface in peer groups.',
      'Leadership and product story often reference prior experience at larger incumbents.',
    ],
    productWorkflowThemes: [
      'Built around boutique class scheduling with strong drag-and-drop stories; appointments are secondary for many evaluations.',
      'Waitlist automation and smart booking rules are highlighted strengths.',
    ],
    paymentsOpsThemes: [
      'Stripe-centered with terminal paths; plan and packaging flexibility is a common compare point (no figures).',
    ],
    integrationThemes: [
      'Google paths skew toward lead forms and ads plus calendar sync rather than full Business Profile parity with some peers.',
    ],
  },
  glofox: {
    marketThemes: [
      'Strong European footprint and gym/HIIT positioning versus US boutique Pilates or Lagree-first brands.',
      'Ownership under a large fitness software holding company shows up in long-term platform conversations.',
    ],
    productWorkflowThemes: [
      'Multi-location class scheduling fits chains; hybrid appointment-heavy studios may feel stretched.',
      'Parent-and-child booking flows are sometimes called easy to misconfigure from the client side.',
    ],
    paymentsOpsThemes: [
      'Stripe-centered with broader currency and local method coverage for international studios.',
    ],
    integrationThemes: [
      'Classpass and Wellhub style marketplace rails are in the typical integration set where those channels matter.',
    ],
  },
  clubready: {
    marketThemes: [
      'Common in gym and club chains; operating cadence and client journey differ from single-location boutique studios.',
    ],
    productWorkflowThemes: [
      'Strength in membership and club workflows; compare carefully if the studio is class-and-retail led with heavy digital product.',
    ],
    paymentsOpsThemes: [
      'Economics and packaging are evaluated heavily in RFPs — keep any outbound mention non-numeric.',
    ],
    integrationThemes: [
      'Verify calendar, access control, and marketing stack fit against boutique expectations.',
    ],
  },
}
