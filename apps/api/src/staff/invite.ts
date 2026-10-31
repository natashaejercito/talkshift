import { prisma } from '../db.js'
import { managementConfigured, ensureAuth0User, passwordSetupLink } from '../auth0/management.js'
import { queueInvite } from '../email/notify.js'

export type InviteResult = { status: 'sent' | 'skipped' | 'failed'; message: string }

export async function inviteStaff(staffId: string): Promise<InviteResult> {
  const staff = await prisma.staff.findUnique({ where: { id: staffId } })
  if (!staff?.active) return { status: 'failed', message: 'Staff member not found.' }
  if (staff.firstSignInAt) return { status: 'skipped', message: `${staff.name} has already signed in.` }
  if (!managementConfigured()) {
    return { status: 'skipped', message: 'Invites are off until the Auth0 management keys are set.' }
  }

  try {
    const auth0Id = staff.auth0Id ?? (await ensureAuth0User(staff.email, staff.name))
    const link = await passwordSetupLink(auth0Id)
    const updated = await prisma.staff.update({
      where: { id: staff.id },
      data: { auth0Id, invitedAt: new Date() },
    })
    await queueInvite(updated, link)
    return { status: 'sent', message: `Invite sent to ${staff.email}.` }
  } catch (e) {
    console.error('[invite]', e)
    return { status: 'failed', message: "The invite couldn't be sent. Try Resend invite in a minute." }
  }
}