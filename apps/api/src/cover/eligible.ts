import { prisma } from '../db.js'
import { toDbDate, weekdayOf } from '../requests/dates.js'
import { rulesToDays } from '../availability/days.js'
import { effectiveFor, warningFor } from '../schedule/routes.js'

export type Slot = { date: string; startMin: number; endMin: number }

// Active staff with no shift that day, and whose availability and approved requests fit the hours.
export async function eligibleStaff(slot: Slot, excludeIds: string[] = []) {
  const day = toDbDate(slot.date)
  const staff = await prisma.staff.findMany({
    where: { active: true, id: { notIn: excludeIds }, shifts: { none: { date: day } } },
    orderBy: { name: 'asc' },
    include: {
      availability: true,
      timeOffRequests: { where: { status: 'APPROVED', startDate: { lte: day }, endDate: { gte: day } } },
    },
  })
  return staff.filter((s) => {
    const rule = rulesToDays(s.availability)[weekdayOf(slot.date)]
    return warningFor(slot, effectiveFor(rule, s.timeOffRequests[0] ?? null)) === null
  })
}