import { describe, it, expect } from 'vitest'
import { cutoffFor, isLate, isIsoDate, weekdayOf } from '../src/requests/dates.js'

const toronto = { timeZone: 'America/Toronto', cutoffWeekday: 3, cutoffMin: 1080 }

describe('dates', () => {
  it('knows the weekday, Monday first', () => {
    expect(weekdayOf('2026-11-16')).toBe(0) // Monday
    expect(weekdayOf('2026-11-22')).toBe(6) // Sunday
  })

  it('rejects impossible dates', () => {
    expect(isIsoDate('2026-02-30')).toBe(false)
    expect(isIsoDate('16/11/2026')).toBe(false)
    expect(isIsoDate('2026-11-16')).toBe(true)
  })
})

describe('cutoff', () => {
  it('closes the week of Nov 16 on Thursday Nov 12', () => {
    expect(cutoffFor('2026-11-18', toronto)).toEqual({ date: '2026-11-12', minutes: 1080 })
    expect(cutoffFor('2026-11-22', toronto)).toEqual({ date: '2026-11-12', minutes: 1080 })
  })

  // 6 PM in Toronto on Nov 12 is 23:00 UTC (EST is UTC-5)
  it('is on time just before 6 PM store time', () => {
    expect(isLate('2026-11-18', new Date('2026-11-12T22:59:00Z'), toronto)).toBe(false)
  })

  it('is late from 6 PM store time', () => {
    expect(isLate('2026-11-18', new Date('2026-11-12T23:00:00Z'), toronto)).toBe(true)
  })

  it("uses the store's time zone, not the server's", () => {
    const vancouver = { ...toronto, timeZone: 'America/Vancouver' }
    // 23:00 UTC is 3 PM in Vancouver, still before its 6 PM cutoff
    expect(isLate('2026-11-18', new Date('2026-11-12T23:00:00Z'), vancouver)).toBe(false)
  })
})