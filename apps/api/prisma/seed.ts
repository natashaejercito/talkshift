import 'dotenv/config'
import { prisma } from '../src/db.js'

const email = process.env.MANAGER_EMAIL?.toLowerCase().trim()
if (!email) throw new Error('Set MANAGER_EMAIL in apps/api/.env')

await prisma.staff.upsert({
  where: { email },
  update: { role: 'STORE_MANAGER', active: true },
  create: {
    email,
    name: process.env.MANAGER_NAME ?? 'Store manager',
    role: 'STORE_MANAGER',
    employmentType: 'FULL_TIME',
    targetDaysPerWeek: 5,
  },
})
console.log(`Manager account ready: ${email}`)
await prisma.$disconnect()