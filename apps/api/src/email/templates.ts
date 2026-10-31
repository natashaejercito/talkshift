import { addDays } from '../requests/dates.js'

const esc = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

export function formatTime(min: number) {
  const h = Math.floor(min / 60)
  const m = min % 60
  const h12 = h % 12 === 0 ? 12 : h % 12
  return `${h12}${m ? `:${String(m).padStart(2, '0')}` : ''} ${h >= 12 ? 'PM' : 'AM'}`
}

const fmtDate = (d: string, opts: Intl.DateTimeFormatOptions = { weekday: 'short', month: 'short', day: 'numeric' }) =>
  new Date(`${d}T00:00:00Z`).toLocaleDateString('en-US', { ...opts, timeZone: 'UTC' })

const fmtHours = (h: number) => `${Number.isInteger(h) ? h : h.toFixed(1)} h`

// Email clients ignore most CSS, so this uses tables and inline styles.
function layout(storeName: string, body: string) {
  return `<!doctype html><html><body style="margin:0;background:#FBF7FA;font-family:Arial,sans-serif;color:#1B1F3B">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:24px 12px">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border:1px solid #E3D6E0;border-radius:14px">
<tr><td style="padding:20px 28px;border-bottom:1px solid #E3D6E0;font-weight:800;font-size:18px">TalkShift <span style="font-weight:400;font-size:14px;color:#5A5F7A">· ${esc(storeName)}</span></td></tr>
<tr><td style="padding:24px 28px;font-size:15px;line-height:1.5">${body}</td></tr>
</table>
<p style="margin:16px 0 0;font-size:12px;color:#5A5F7A">Please don't reply to this email. Make any changes in TalkShift.</p>
</td></tr></table></body></html>`
}

const button = (href: string, label: string) =>
  `<a href="${esc(href)}" style="display:inline-block;background:#2446A8;color:#ffffff;text-decoration:none;font-weight:700;padding:12px 20px;border-radius:10px">${esc(label)}</a>`

type ShiftLine = { date: string; startMin: number; endMin: number; note: string | null }

export function scheduleEmail(o: {
  name: string
  storeName: string
  weekStart: string
  shifts: ShiftLine[]
  changedDates: string[] // only for updates
  isUpdate: boolean
  appUrl: string
}) {
  const weekLabel = `${fmtDate(o.weekStart, { month: 'short', day: 'numeric' })} – ${fmtDate(addDays(o.weekStart, 6), { month: 'short', day: 'numeric' })}`
  const total = o.shifts.reduce((t, s) => t + (s.endMin - s.startMin) / 60, 0)
  const first = o.name.split(' ')[0]

  // Shifts, plus days whose shift was removed in this update.
  const dates = [...new Set([...o.shifts.map((s) => s.date), ...o.changedDates])].sort()
  const rows = dates.map((date) => {
    const s = o.shifts.find((x) => x.date === date)
    return {
      day: fmtDate(date),
      time: s ? `${formatTime(s.startMin)} – ${formatTime(s.endMin)}` : 'No shift (removed)',
      note: s?.note ?? '',
      changed: o.changedDates.includes(date),
    }
  })

  const subject = o.isUpdate
    ? `Updated schedule: week of ${fmtDate(o.weekStart, { month: 'short', day: 'numeric' })}`
    : `Your shifts for ${weekLabel} (${fmtHours(total)})`

  const intro = o.isUpdate
    ? `Your schedule for <strong>${weekLabel}</strong> changed. Changed days are marked.`
    : `The schedule for <strong>${weekLabel}</strong> is out. You have ${o.shifts.length} ${o.shifts.length === 1 ? 'shift' : 'shifts'}, ${fmtHours(total)}.`

  const table = rows.length
    ? `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:16px 0;border-collapse:collapse">${rows
        .map(
          (r) => `<tr style="${r.changed ? 'background:#E4ECFF' : ''}">
<td style="padding:10px 8px;border-bottom:1px solid #F1E6EE;font-weight:700">${esc(r.day)}${r.changed ? ' <span style="color:#2446A8;font-size:12px">CHANGED</span>' : ''}</td>
<td style="padding:10px 8px;border-bottom:1px solid #F1E6EE">${esc(r.time)}${r.note ? `<br><span style="color:#5A5F7A;font-size:13px">${esc(r.note)}</span>` : ''}</td></tr>`,
        )
        .join('')}</table>`
    : `<p>You have no shifts this week.</p>`

  const html = layout(
    o.storeName,
    `<h1 style="margin:0 0 8px;font-size:22px">Hi ${esc(first)},</h1><p style="margin:0">${intro}</p>${table}
${o.shifts.length ? '<p style="margin:0 0 16px;font-size:13px;color:#5A5F7A">The attached calendar file adds these shifts to Google or Apple Calendar.</p>' : ''}
${button(`${o.appUrl}/schedule`, 'Open my schedule')}`,
  )

  const text = [
    `Hi ${first},`,
    '',
    o.isUpdate ? `Your schedule for ${weekLabel} changed:` : `Your shifts for ${weekLabel} (${fmtHours(total)}):`,
    ...rows.map((r) => `- ${r.day}: ${r.time}${r.note ? ` (${r.note})` : ''}${r.changed ? '  [changed]' : ''}`),
    '',
    `Open your schedule: ${o.appUrl}/schedule`,
  ].join('\n')

  return { subject, html, text }
}

export function inviteEmail(o: { name: string; storeName: string; link: string; appUrl: string }) {
  const first = o.name.split(' ')[0]
  const subject = `You're on the ${o.storeName} schedule in TalkShift`
  const html = layout(
    o.storeName,
    `<h1 style="margin:0 0 8px;font-size:22px">Hi ${esc(first)},</h1>
<p>Your manager added you to TalkShift. It's where you'll see your shifts, set your availability and request time off.</p>
<p>Set your password to get started. The link works for 7 days.</p>
<p style="margin:20px 0">${button(o.link, 'Set my password')}</p>
<p style="font-size:13px;color:#5A5F7A">After that, sign in any time at ${esc(o.appUrl)}</p>`,
  )
  const text = `Hi ${first},\n\nYour manager added you to TalkShift at ${o.storeName}.\nSet your password (link works for 7 days):\n${o.link}\n\nThen sign in at ${o.appUrl}`
  return { subject, html, text }
}
export const shiftLabel = (s: { date: string; startMin: number; endMin: number }) =>
  `${fmtDate(s.date)}, ${formatTime(s.startMin)} – ${formatTime(s.endMin)}`

// A short email: a bold line, a few sentences and one button.
export function noticeEmail(o: {
  name: string
  storeName: string
  heading: string
  lines: string[]
  link: string
  linkLabel: string
}) {
  const first = o.name.split(' ')[0]
  const html = layout(
    o.storeName,
    `<h1 style="margin:0 0 8px;font-size:22px">Hi ${esc(first)},</h1>
<p style="margin:0 0 8px;font-weight:700">${esc(o.heading)}</p>
${o.lines.map((l) => `<p style="margin:0 0 8px">${esc(l)}</p>`).join('')}
<p style="margin:20px 0 0">${button(o.link, o.linkLabel)}</p>`,
  )
  const text = [`Hi ${first},`, '', o.heading, ...o.lines, '', `${o.linkLabel}: ${o.link}`].join('\n')
  return { html, text }
}