import { Resend } from 'resend'
import { prisma } from '../db.js'
import type { Notification } from '../generated/prisma/client.js'

type Attachment = { filename: string; contentType: string; content: string }
export type Sender = (n: Notification) => Promise<void>

const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null

// Real sending with Resend, or print to the terminal when no key is set.
export const sendEmail: Sender = async (n) => {
  if (!resend) {
    console.log(`\n[email not sent: no RESEND_API_KEY] to ${n.toEmail}\nSubject: ${n.subject}\n${n.text}\n`)
    return
  }
  const attachments = (n.attachments as Attachment[] | null) ?? []
  const { error } = await resend.emails.send({
    from: process.env.EMAIL_FROM!,
    to: n.toEmail,
    subject: n.subject,
    html: n.html,
    text: n.text,
    attachments: attachments.map((a) => ({
      filename: a.filename,
      contentType: a.contentType,
      content: Buffer.from(a.content, 'base64'),
    })),
  })
  if (error) throw new Error(error.message)
}

const MAX_ATTEMPTS = 3
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

// Send whatever is due. Failures wait 1, then 2 minutes before retrying, then give up.
export async function processQueue(
  send: Sender = sendEmail,
  { now = new Date(), limit = 10, pauseMs = 600 }: { now?: Date; limit?: number; pauseMs?: number } = {},
) {
  const due = await prisma.notification.findMany({
    where: { status: 'QUEUED', sendAfter: { lte: now } },
    orderBy: { createdAt: 'asc' },
    take: limit,
  })

  for (const n of due) {
    const attempts = n.attempts + 1
    try {
      await send(n)
      await prisma.notification.update({
        where: { id: n.id },
        data: { status: 'SENT', sentAt: new Date(), attempts, lastError: null },
      })
    } catch (e) {
      await prisma.notification.update({
        where: { id: n.id },
        data: {
          attempts,
          lastError: e instanceof Error ? e.message : String(e),
          status: attempts >= MAX_ATTEMPTS ? 'FAILED' : 'QUEUED',
          sendAfter: new Date(now.getTime() + attempts * 60_000),
        },
      })
    }
    if (pauseMs) await sleep(pauseMs) // Resend's free plan allows about 2 emails per second
  }
  return due.length
}

// Check for due emails every 5 seconds while the API runs.
export function startEmailWorker() {
  const tick = async () => {
    try {
      await processQueue()
    } catch (e) {
      console.error('[email worker]', e)
    } finally {
      setTimeout(tick, 5000)
    }
  }
  void tick()
}