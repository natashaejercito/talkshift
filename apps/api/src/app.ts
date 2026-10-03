import cors from 'cors'
import helmet from 'helmet'
import { requireAuth, requireRole } from './auth/middleware.js'
import express, { type ErrorRequestHandler } from 'express'

export const app = express()
app.use(helmet())
app.use(cors({ origin: 'http://localhost:5173' }))
app.use(express.json())

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


const errorHandler: ErrorRequestHandler = (err, _req, res, _next) => {
  const status = typeof err.status === 'number' ? err.status : 500
  if (status >= 500) {
    console.error(err)
    res.status(status).json({ error: 'Something went wrong' })
    return
  }
  res.status(status).json({ error: status === 401 ? 'Not signed in' : err.message })
}