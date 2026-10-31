export type CutoffSettings = { timeZone: string; cutoffWeekday: number; cutoffMin: number }

// Dates travel as "YYYY-MM-DD" strings. Midnight UTC is only used to do arithmetic on them.
const toUtc = (d: string) => new Date(`${d}T00:00:00Z`)

export const isIsoDate = (s: string) =>
  /^\d{4}-\d{2}-\d{2}$/.test(s) && !Number.isNaN(toUtc(s).getTime()) && toUtc(s).toISOString().startsWith(s)

export const toDbDate = toUtc
export const fromDbDate = (d: Date) => d.toISOString().slice(0, 10)

export function addDays(d: string, n: number) {
  const x = toUtc(d)
  x.setUTCDate(x.getUTCDate() + n)
  return fromDbDate(x)
}

export const weekdayOf = (d: string) => (toUtc(d).getUTCDay() + 6) % 7 // 0 = Monday
export const weekStartOf = (d: string) => addDays(d, -weekdayOf(d))
export const daysBetween = (a: string, b: string) =>
  Math.round((toUtc(b).getTime() - toUtc(a).getTime()) / 86_400_000)

// The store's local date and time right now.
export function storeNow(now: Date, timeZone: string) {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat('en-CA', {
      timeZone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hourCycle: 'h23',
    })
      .formatToParts(now)
      .map((p) => [p.type, p.value]),
  )
  return {
    date: `${parts.year}-${parts.month}-${parts.day}`,
    minutes: Number(parts.hour) * 60 + Number(parts.minute),
  }
}

// Requests for a schedule week close on the cutoff day of the week before.
export function cutoffFor(date: string, c: CutoffSettings) {
  return { date: addDays(weekStartOf(date), -7 + c.cutoffWeekday), minutes: c.cutoffMin }
}

export function isLate(date: string, now: Date, c: CutoffSettings) {
  const n = storeNow(now, c.timeZone)
  const cut = cutoffFor(date, c)
  return n.date > cut.date || (n.date === cut.date && n.minutes >= cut.minutes)
}