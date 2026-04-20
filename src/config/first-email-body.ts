import { greetingFirstToken } from '@/lib/booking-software'

/**
 * First-email body (plain text) → Smartlead `personalized_intro`.
 *
 * **firstEmailBodyExamples** — Reference themes for the AI writer (see `openai-email.ts`).
 * Output always opens with **Hi {FirstName},** or **Hi there,** (see `buildFirstEmailPersonalizedIntro`).
 * Example 1 is the **static** fallback when AI is skipped or unavailable.
 */

export const firstEmailBodyExamples = [
  {
    id: 'example_1',
    label: 'Example 1 - original',
    painParagraph:
      'Full class schedules usually force scheduling, retail, and payments to stay in sync or something slips.',
    valueParagraph:
      'Arketa ties scheduling, retail, and payments for studios, plus room for the rest of the business.',
    defaultCta: 'Worth a short call?',
  },
  {
    id: 'example_2',
    label: 'Example 2 - concise variant',
    painParagraph:
      'Most boutique studios I talk to want scheduling and follow-up tighter without adding headcount.',
    valueParagraph:
      'Arketa pairs purpose-built software with real wellness-business experience.',
    defaultCta: 'Open to a quick chat?',
  },
] as const

// Default body used by the app. Keep this in sync with the primary example.
export const firstEmailBodyCopy = firstEmailBodyExamples[0]

/**
 * Builds the email body blocks (no signature). Line 1: Hi Name, or Hi there,
 */
export function buildFirstEmailPersonalizedIntro(
  firstName?: string | null,
  cta: string = firstEmailBodyCopy.defaultCta
): string {
  const t = greetingFirstToken(firstName)
  const parts: string[] = []
  if (t) {
    parts.push(`Hi ${t},`)
  } else {
    parts.push('Hi there,')
  }
  parts.push(firstEmailBodyCopy.painParagraph)
  parts.push(firstEmailBodyCopy.valueParagraph)
  parts.push(cta)
  return parts.join('\n\n')
}
