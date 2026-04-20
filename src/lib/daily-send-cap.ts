/**
 * Client-only daily cap for Smartlead enrollments from this app.
 * Counts per logged-in user, per local calendar day, in localStorage (this browser only).
 */

export function localCalendarDateKey(): string {
  const d = new Date()
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

function storageKey(userId: string): string {
  return `sdr-outbound-daily-sends-${userId}-${localCalendarDateKey()}`
}

/** Parsed from NEXT_PUBLIC_MAX_SENDS_PER_DAY. Null/invalid/0 = no cap. */
export function getMaxSendsPerDayFromEnv(): number | null {
  const raw = process.env.NEXT_PUBLIC_MAX_SENDS_PER_DAY?.trim()
  if (!raw) return null
  const n = parseInt(raw, 10)
  if (!Number.isFinite(n) || n <= 0) return null
  return n
}

export function getDailySendCount(userId: string): number {
  if (typeof window === 'undefined' || !userId) return 0
  try {
    const v = localStorage.getItem(storageKey(userId))
    if (v == null || v === '') return 0
    const n = parseInt(v, 10)
    return Number.isFinite(n) && n >= 0 ? n : 0
  } catch {
    return 0
  }
}

/** Returns new total after increment. */
export function incrementDailySendCount(userId: string, delta: number = 1): number {
  if (typeof window === 'undefined' || !userId || delta < 1) {
    return getDailySendCount(userId)
  }
  const next = getDailySendCount(userId) + delta
  try {
    localStorage.setItem(storageKey(userId), String(next))
  } catch {
    /* ignore quota */
  }
  return next
}

export function isAtOrOverDailyCap(userId: string, max: number): boolean {
  return getDailySendCount(userId) >= max
}

export function remainingSendsToday(userId: string, max: number): number {
  return Math.max(0, max - getDailySendCount(userId))
}
