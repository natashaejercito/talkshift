import { prisma } from '../db.js'
import type { Staff } from '../generated/prisma/client.js'
import type { PublishedShift } from '../schedule/routes.js'
import { scheduleEmail, inviteEmail } from './templates.js'
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
}