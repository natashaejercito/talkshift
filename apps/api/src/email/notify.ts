import { prisma } from '../db.js'
import type { Staff } from '../generated/prisma/client.js'
import type { PublishedShift } from '../schedule/routes.js'
import { scheduleEmail, inviteEmail, noticeEmail, shiftLabel } from './templates.js'
import { shiftsToIcs } from './ics.js'

const storeName = () => process.env.STORE_NAME ?? 'your store'
const appUrl = () => process.env.WEB_URL ?? 'http://localhost:5173'
const signature = (s?: PublishedShift) => (s ? `${s.startMin}-${s.endMin}-${s.note ?? ''}` : '')

export async function queueScheduleEmails(o: {
  weekStart: string
  version: number
  before: PublishedShift[]
  after: PublishedShift[]
  staffIds: string[]
}) {
  if (o.staffIds.length === 0) return 0
  const [staff, settings] = await Promise.all([
    prisma.staff.findMany({ where: { id: { in: o.staffIds }, active: true } }),
    prisma.storeSettings.findUniqueOrThrow({ where: { id: 1 } }),
  ])
  const isUpdate = o.version > 1

  const data = staff.map((member) => {
    const mine = o.after.filter((s) => s.staffId === member.id).sort((a, b) => a.date.localeCompare(b.date))
    const old = o.before.filter((s) => s.staffId === member.id)
    const dates = [...new Set([...mine, ...old].map((s) => s.date))]
    const changedDates = dates.filter(
      (d) => signature(mine.find((s) => s.date === d)) !== signature(old.find((s) => s.date === d)),
    )

    const email = scheduleEmail({
      name: member.name,
      storeName: storeName(),
      weekStart: o.weekStart,
      shifts: mine,
      changedDates: isUpdate ? changedDates : [],
      isUpdate,
      appUrl: appUrl(),
    })
    const ics = shiftsToIcs({
      staffId: member.id,
      shifts: mine,
      timeZone: settings.timeZone,
      storeName: storeName(),
      sequence: o.version,
    })

    return {
      staffId: member.id,
      toEmail: member.email,
      template: isUpdate ? 'schedule_updated' : 'schedule_published',
      ...email,
      attachments: mine.length
        ? [{ filename: `shifts-${o.weekStart}.ics`, contentType: 'text/calendar', content: Buffer.from(ics).toString('base64') }]
        : undefined,
    }
  })

  await prisma.notification.createMany({ data })
  return data.length
}

export async function queueInvite(member: Staff, link: string) {
  const email = inviteEmail({ name: member.name, storeName: storeName(), link, appUrl: appUrl() })
  await prisma.notification.create({
    data: { staffId: member.id, toEmail: member.email, template: 'invite', ...email },
  })
}type Slot = { date: string; startMin: number; endMin: number }
type Notice = { heading: string; lines: string[]; path: string; linkLabel: string }

const managers = () =>
  prisma.staff.findMany({ where: { active: true, role: { in: ['STORE_MANAGER', 'ASSISTANT_STORE_MANAGER'] } } })

async function queueNotices(people: Staff[], template: string, subject: string, notice: Notice) {
  if (people.length === 0) return 0
  await prisma.notification.createMany({
    data: people.map((p) => ({
      staffId: p.id,
      toEmail: p.email,
      template,
      subject,
      ...noticeEmail({
        name: p.name,
        storeName: storeName(),
        heading: notice.heading,
        lines: notice.lines,
        link: `${appUrl()}${notice.path}`,
        linkLabel: notice.linkLabel,
      }),
    })),
  })
  return people.length
}

// Managers hear first. Free staff (who aren't managers) are told the shift is open.
export async function queueCoverRequested(o: { requester: Staff; slot: Slot; reason: string | null; eligible: Staff[] }) {
  const when = shiftLabel(o.slot)
  const bosses = (await managers()).filter((m) => m.id !== o.requester.id)
  const bossIds = new Set(bosses.map((m) => m.id))

  const toManagers = await queueNotices(bosses, 'cover_requested', `${o.requester.name} can't make it: ${when}`, {
    heading: `${o.requester.name} can't make their shift on ${when}.`,
    lines: [
      o.reason ? `Reason: ${o.reason}` : 'No reason given.',
      `${o.eligible.length} staff are free and available. They've been told the shift is open.`,
    ],
    path: '/manager/inbox',
    linkLabel: 'Find cover',
  })
  const toStaff = await queueNotices(
    o.eligible.filter((s) => !bossIds.has(s.id)),
    'shift_available',
    `Shift available: ${when}`,
    {
      heading: `A shift is open on ${when}.`,
      lines: ["You're free and available then. If you can take it, let your manager know in TalkShift."],
      path: '/schedule',
      linkLabel: 'I can take it',
    },
  )
  return toManagers + toStaff
}

export async function queueOfferMade(o: { offerer: Staff; requester: Staff; slot: Slot }) {
  const when = shiftLabel(o.slot)
  return queueNotices(await managers(), 'pickup_offered', `${o.offerer.name} can cover ${when}`, {
    heading: `${o.offerer.name} can take ${o.requester.name}'s shift on ${when}.`,
    lines: ['Confirm it in TalkShift, and both of them get their updated schedule.'],
    path: '/manager/inbox',
    linkLabel: 'Review',
  })
}

export async function queueCoverFilled(o: { slot: Slot; declined: Staff[] }) {
  const when = shiftLabel(o.slot)
  return queueNotices(o.declined, 'cover_filled', `Shift covered: ${when}`, {
    heading: `Thanks for offering. The shift on ${when} has been covered.`,
    lines: ["Your schedule hasn't changed."],
    path: '/schedule',
    linkLabel: 'Open my schedule',
  })
}