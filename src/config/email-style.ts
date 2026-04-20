/**
 * Email style config: tone and subject-line rules for OpenAI.
 * The first email **body** is AI-written using themes from `first-email-body.ts` (examples) plus HubSpot data;
 * the same file’s example 1 is the **static** fallback when AI is skipped. See docs/GEMINI-TRAINING.md.
 */

import { buildFirstEmailPersonalizedIntro } from '@/config/first-email-body'

/** Example body shown in config comments / docs (Sarah = sample first name). */
const EXAMPLE_BODY = buildFirstEmailPersonalizedIntro('Sarah')

/** Build email signature with the sending user's name. */
export function getEmailSignature(senderFirstName: string, senderLastName: string = ''): string {
  const name = [senderFirstName, senderLastName].filter(Boolean).join(' ')
  return `Best,\n${name || 'Arketa'}\nArketa Sales Development Representative`
}

/**
 * Prefer the **selected Smartlead inbox** display name so the sign-off matches the actual From line.
 * Falls back to Google/Supabase profile (firstName / lastName from the dashboard).
 */
export function resolveSignatureNameParts(
  accounts: { id: number; from_name?: string }[],
  selectedInboxIds: Iterable<number>,
  googleFirst: string,
  googleLast: string
): { first: string; last: string } {
  for (const id of Array.from(selectedInboxIds)) {
    const acc = accounts.find((a) => a.id === id)
    const raw = acc?.from_name?.trim()
    if (raw) {
      const parts = raw.split(/\s+/)
      return {
        first: parts[0] || googleFirst,
        last: parts.slice(1).join(' ') || googleLast,
      }
    }
  }
  return { first: googleFirst, last: googleLast }
}

export const emailStyleConfig = {
  /**
   * TONE — Used when OpenAI writes the **subject line** (body is generated separately in openai-email.ts).
   */
  tone: `Friendly, professional, industry-smart (strategic infrastructure partner — not generic SaaS). Subjects sound like a real person typed them.`,

  /**
   * Reference body shape (AI follows this; wording is paraphrased). Static fallback = example 1 in first-email-body.ts.
   */
  fullEmailStructure: [
    'Line 1: "Hi Libby," or "Hi there," — AI body is an SDR follow-up (call notes first, competitive gap-fill if thin).',
    'Opener: if last call < 2 months ago → "I wanted to touch base again." only; if 2+ months ago → add "since our last chat in [Month]." Then Studios using [platform] often feel…',
    'Pain + impact, then Arketa tailored to that, then CTA: quick Zoom + their use case in the dashboard.',
    'Cap 75 words max total; see buildSdrFollowUpBodyPrompt in openai-email.ts.',
  ],

  /**
   * Notes for editors (subject rules are sent to OpenAI; body rules live in openai-email.ts prompt).
   */
  rules: [
    'Edit firstEmailBodyExamples in src/config/first-email-body.ts to steer body themes (AI paraphrases; example 1 is the static fallback).',
    'OpenAI generates subject lines using tone + subjectLineRules below.',
    'Signatures are added after the body; do not put a sign-off inside first-email-body.ts.',
  ],

  subjectLineRules: [
    'NEVER include the prospect\'s first name, last name, or nickname in the subject — not even "for Ben" or "Matt, …". The email body opens with "Hi FirstName," or "Hi there,"; the subject stays name-free.',
    'Do NOT name a specific booking vendor in the subject (no Mindbody, Glofox, WellnessLiving, etc.). Generic phrases like "your booking platform" or "business platform" are OK.',
    'Rotate among these patterns (no names): "Quick question about your booking platform" · "Is your business platform doing enough?" · "Quick question for you"',
    'Keep it concise: aim under 55 characters. No ALL CAPS, no clickbait, no emojis.',
  ],

  /**
   * Reference example (body matches production template). Not used in prompts today; kept for docs parity.
   */
  examples: [
    {
      leadSummary: 'Sarah Chen, Owner at FitLife Studio (sample — real emails use the lead first name from HubSpot).',
      opening: EXAMPLE_BODY,
    },
  ],
}
