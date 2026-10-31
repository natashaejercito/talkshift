import { describe, it, expect, beforeEach, afterAll } from 'vitest'
import { prisma } from '../src/db.js'
import { resetDb } from './helpers.js'
import { processQueue } from '../src/email/queue.js'
import { shiftsToIcs } from '../src/email/ics.js'

beforeEach(resetDb)
afterAll(() => prisma.$disconnect())

const queueOne = () =>
  prisma.notification.create({
    data: { toEmail: 'maya@example.com', template: 'test', subject: 'Hi', html: '<p>Hi</p>', text: 'Hi' },
  })

describe('email queue', () => {
  it('sends queued emails and marks them sent', async () => {
    const n = await queueOne()
    const sent: string[] = []
    await processQueue(async (x) => void sent.push(x.toEmail), { pauseMs: 0 })

    expect(sent).toEqual(['maya@example.com'])
    expect((await prisma.notification.findUniqueOrThrow({ where: { id: n.id } })).status).toBe('SENT')
  })

  it('retries failures, then gives up after 3 attempts', async () => {
    const n = await queueOne()
    const fail = async () => {
      throw new Error('Resend is down')
    }
    const later = (minutes: number) => new Date(Date.now() + minutes * 60_000)

    await processQueue(fail, { pauseMs: 0 })
    await processQueue(fail, { pauseMs: 0 }) // too soon: waits a minute first
    expect((await prisma.notification.findUniqueOrThrow({ where: { id: n.id } })).attempts).toBe(1)

    await processQueue(fail, { pauseMs: 0, now: later(2) })
    await processQueue(fail, { pauseMs: 0, now: later(10) })

    const final = await prisma.notification.findUniqueOrThrow({ where: { id: n.id } })
    expect(final).toMatchObject({ status: 'FAILED', attempts: 3, lastError: 'Resend is down' })
  })
})

describe('calendar file', () => {
  it('has one event per shift in the store time zone', () => {
    const ics = shiftsToIcs({
      staffId: 'abc',
      shifts: [{ date: '2026-11-16', startMin: 600, endMin: 1080, note: 'Training, floor' }],
      timeZone: 'America/Toronto',
      storeName: 'Test Store',
      sequence: 2,
    })
    expect(ics).toContain('UID:abc-2026-11-16@talkshift')
    expect(ics).toContain('DTSTART;TZID=America/Toronto:20261116T100000')
    expect(ics).toContain('DTEND;TZID=America/Toronto:20261116T180000')
    expect(ics).toContain('SEQUENCE:2')
    expect(ics).toContain('Training\\, floor') // commas escaped
  })
})