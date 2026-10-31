const toUtc = (d: string) => new Date(`${d}T00:00:00Z`)

export function addDays(d: string, n: number) {
  const x = toUtc(d)
  x.setUTCDate(x.getUTCDate() + n)
  return x.toISOString().slice(0, 10)
}
export const weekdayOf = (d: string) => (toUtc(d).getUTCDay() + 6) % 7 // 0 = Monday
export const weekStartOf = (d: string) => addDays(d, -weekdayOf(d))
export const todayLocal = () => new Date().toLocaleDateString('en-CA') // YYYY-MM-DD

export function formatDate(d: string, opts: Intl.DateTimeFormatOptions = { weekday: 'short', month: 'short', day: 'numeric' }) {
  return toUtc(d).toLocaleDateString('en-US', { ...opts, timeZone: 'UTC' })
}

export const formatWeek = (start: string) =>
  `${formatDate(start, { month: 'short', day: 'numeric' })} – ${formatDate(addDays(start, 6), { month: 'short', day: 'numeric' })}`

export const formatHours = (h: number) => `${Number.isInteger(h) ? h : h.toFixed(1)} h`