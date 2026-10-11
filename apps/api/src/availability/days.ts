import { z } from 'zod'
import type { AvailabilityRule, StoreHours } from '../generated/prisma/client.js'

export const daySchema = z.discriminatedUnion('status', [
  z.object({ status: z.literal('ALL_DAY') }),
  z.object({ status: z.literal('UNAVAILABLE') }),
  z.object({
    status: z.literal('WINDOW'),
    start: z.number().int().min(0).max(1440),
    end: z.number().int().min(0).max(1440),
  }),
])
export const weekSchema = z.array(daySchema).length(7)
export type Day = z.infer<typeof daySchema>

const DAY_NAMES = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']

// Returns an error message, or null when every "Between" day fits the store's hours.
export function checkStoreHours(days: Day[], hours: StoreHours[]): string | null {
  for (let i = 0; i < 7; i++) {
    const d = days[i]
    if (d.status !== 'WINDOW') continue
    if (d.start >= d.end) return `${DAY_NAMES[i]}: the start time must be before the end time.`
    const h = hours.find((x) => x.weekday === i)
    if (h && (d.start < h.openMin || d.end > h.closeMin)) {
      return `${DAY_NAMES[i]}: times must be within store hours.`
    }
  }
  return null
}

// Approved rules → 7 days, Monday first. null = never set.
export function rulesToDays(rules: AvailabilityRule[]): (Day | null)[] {
  return Array.from({ length: 7 }, (_, weekday): Day | null => {
    const r = rules.find((x) => x.weekday === weekday)
    if (!r) return null
    if (r.status === 'WINDOW') return { status: 'WINDOW', start: r.startMin!, end: r.endMin! }
    return { status: r.status }
  })
}