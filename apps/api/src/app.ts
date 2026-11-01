import cors from 'cors'
import helmet from 'helmet'
import { requireAuth, requireRole } from './auth/middleware.js'
import express, { type ErrorRequestHandler } from 'express'
import { staffRouter } from './staff/routes.js'
import { availabilityRouter } from './availability/routes.js'
import { requestsRouter } from './requests/routes.js'
import { inboxRouter } from './inbox/routes.js'
import { scheduleRouter } from './schedule/routes.js'
import { coverRouter } from './cover/routes.js'
import { auditRouter } from './audit/routes.js'

export const app = express()
app.use(helmet())
app.use(cors({ origin: 'http://localhost:5173' }))
app.use(express.json())

app.set('trust proxy', 2) // Vercel → Render → us, so req.ip is the real visitor


app.get('/api/health', (_req, res) => {
  res.json({ ok: true })
})

app.get('/api/me', ...requireAuth, (req, res) => {
  const { id, name, email, role } = req.staff!
  res.json({ id, name, email, role })
})

app.get('/api/manager/ping', ...requireAuth, requireRole('STORE_MANAGER', 'ASSISTANT_STORE_MANAGER'), (_req, res) => {
  res.json({ ok: true })
})

app.use('/api/staff', staffRouter)
app.use('/api/availability', availabilityRouter)
app.use('/api/requests', requestsRouter)
app.use('/api/inbox', inboxRouter)
app.use('/api/schedule', scheduleRouter)
app.use('/api/cover', coverRouter)
app.use('/api/audit', auditRouter)

const errorHandler: ErrorRequestHandler = (err, _req, res, _next) => {
  const status = typeof err.status === 'number' ? err.status : 500
  if (status >= 500) {
    console.error(err)
    res.status(status).json({ error: 'Something went wrong' })
    return
  }
  res.status(status).json({ error: status === 401 ? 'Not signed in' : err.message })
}