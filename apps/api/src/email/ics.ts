import { formatTime } from './templates.js'

const escapeText = (s: string) => s.replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\n/g, '\\n')
const hhmm = (min: number) => `${String(Math.floor(min / 60)).padStart(2, '0')}${String(min % 60).padStart(2, '0')}00`

export function shiftsToIcs(o: {
  staffId: string
  shifts: { date: string; startMin: number; endMin: number; note: string | null }[]
  timeZone: string
  storeName: string
  sequence: number
}) {
  const stamp = new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '')
  const lines = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//TalkShift//Schedule//EN', 'CALSCALE:GREGORIAN', 'METHOD:PUBLISH']

  for (const s of o.shifts) {
    const day = s.date.replace(/-/g, '')
    lines.push(
      'BEGIN:VEVENT',
      `UID:${o.staffId}-${s.date}@talkshift`, // same UID on republish, so calendars update instead of duplicating
      `SEQUENCE:${o.sequence}`,
      `DTSTAMP:${stamp}`,
      `DTSTART;TZID=${o.timeZone}:${day}T${hhmm(s.startMin)}`,
      `DTEND;TZID=${o.timeZone}:${day}T${hhmm(s.endMin)}`,
      `SUMMARY:${escapeText(`Shift at ${o.storeName}`)}`,
      `DESCRIPTION:${escapeText(`${formatTime(s.startMin)} – ${formatTime(s.endMin)}${s.note ? `\n${s.note}` : ''}`)}`,
      'END:VEVENT',
    )
  }
  lines.push('END:VCALENDAR')
  return lines.join('\r\n')
}