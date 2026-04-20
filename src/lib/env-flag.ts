/** Reads Vercel / .env boolean flags tolerantly (trim, case, common truthy strings). */
export function envFlagTruthy(raw: string | undefined): boolean {
  const s = (raw ?? '').trim().toLowerCase()
  return s === 'true' || s === '1' || s === 'yes' || s === 'on'
}

/**
 * Read `NEXT_PUBLIC_*` without static `process.env.NEXT_PUBLIC_*` access.
 * Next inlines static NEXT_PUBLIC references at **build** time, so changing
 * Vercel env after deploy does not update the baked literal. Dynamic `process.env[name]`
 * reads **runtime** env on the server (each deploy still bakes server-only vars normally).
 */
export function runtimeNextPublic(suffix: string): string | undefined {
  const name = `NEXT_PUBLIC_${suffix}`
  return process.env[name]
}

export function readHubspotLiveOutbound(): boolean {
  return envFlagTruthy(runtimeNextPublic('LIVE_OUTBOUND'))
}

/**
 * Smartlead mock / console-only sends (no Add Lead API from the app UI path).
 * Precedence: SMARTLEAD_LIVE_SENDING or SMARTLEAD_FORCE_PRODUCTION_SEND → always live;
 * else SMARTLEAD_TEST_MODE when set (server-only, overrides public);
 * else NEXT_PUBLIC_SMARTLEAD_TEST_MODE.
 */
export function readSmartleadTestOnly(): boolean {
  if (
    envFlagTruthy(process.env.SMARTLEAD_LIVE_SENDING) ||
    envFlagTruthy(process.env.SMARTLEAD_FORCE_PRODUCTION_SEND)
  ) {
    return false
  }
  const server = (process.env.SMARTLEAD_TEST_MODE ?? '').trim()
  if (server !== '') {
    return envFlagTruthy(process.env.SMARTLEAD_TEST_MODE)
  }
  return envFlagTruthy(runtimeNextPublic('SMARTLEAD_TEST_MODE'))
}
