/**
 * Rule-based first email (no AI). Same shape as AI output for Smartlead + editor.
 */
import { buildFirstEmailPersonalizedIntro } from '@/config/first-email-body'
import { getEmailSignature } from '@/config/email-style'
import type { GeneratedEmail, HubSpotContact } from '@/types'

export function buildStaticPersonalizedEmail(
  lead: HubSpotContact,
  senderFirstName: string,
  senderLastName: string
): GeneratedEmail {
  const personalizedIntro = buildFirstEmailPersonalizedIntro(lead.properties.firstname)
  const signature = getEmailSignature(senderFirstName, senderLastName)
  return {
    subject: 'Quick question about your booking platform',
    personalizedIntro,
    fullBody: `${personalizedIntro}\n\n${signature}`,
  }
}
