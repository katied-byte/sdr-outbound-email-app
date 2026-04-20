/**
 * Shared rules for “skip Gemini” flags (template-only mode).
 * - Use NEXT_PUBLIC_* so the **browser** can skip calling /api/generate (avoids quota entirely).
 * - Server routes also honor SKIP_GEMINI_PERSONALIZATION for API-only callers.
 */
export function isTruthySkipFlag(value: string | undefined): boolean {
  const t = value?.trim().toLowerCase()
  return t === 'true' || t === '1' || t === 'yes' || t === 'on'
}

function isExplicitFalseSkipFlag(value: string | undefined): boolean {
  const t = value?.trim().toLowerCase()
  return t === 'false' || t === '0' || t === 'no' || t === 'off'
}

/** Server + API routes */
export function skipGeminiFromProcessEnv(): boolean {
  if (typeof process === 'undefined' || !process.env) return false
  const pub = process.env.NEXT_PUBLIC_SKIP_GEMINI_PERSONALIZATION
  const server = process.env.SKIP_GEMINI_PERSONALIZATION
  // Explicit false in either flag should always disable skip mode.
  if (isExplicitFalseSkipFlag(pub) || isExplicitFalseSkipFlag(server)) {
    return false
  }
  return (
    isTruthySkipFlag(server) ||
    isTruthySkipFlag(pub)
  )
}

/** Client components (only NEXT_PUBLIC_ exists in the bundle) */
export function skipGeminiFromPublicEnv(): boolean {
  if (typeof process === 'undefined' || !process.env) return false
  const pub = process.env.NEXT_PUBLIC_SKIP_GEMINI_PERSONALIZATION
  if (isExplicitFalseSkipFlag(pub)) return false
  return isTruthySkipFlag(pub)
}
