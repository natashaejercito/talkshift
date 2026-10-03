import { config } from 'dotenv'

config({ path: '.env.test', override: true, quiet: true })

if (!process.env.DATABASE_URL?.includes('test')) {
  throw new Error('Tests must run against the test database. Check apps/api/.env.test')
}