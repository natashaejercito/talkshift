import 'dotenv/config'
import express from 'express'
import cors from 'cors'
import helmet from 'helmet'
import cookieParser from 'cookie-parser'
import { authRouter } from './auth/routes.js'
import { requireAuth, requireRole } from './auth/middleware.js'

const app = express()
app.use(helmet())
app.use(cors({ origin: 'http://localhost:5173', credentials: true }))
app.use(express.json())
app.use(cookieParser())

app.get('/api/health', (_req, res) => {
  res.json({ ok: true })
})

app.use('/api/auth', authRouter)

app.get('/api/me', requireAuth, (req, res) => {
  const { id, name, email, role } = req.staff!
  res.json({ id, name, email, role })
})

// Example manager-only route, to check the guard works
app.get('/api/manager/ping', requireAuth, requireRole('STORE_MANAGER', 'ASSISTANT_STORE_MANAGER'), (_req, res) => {
  res.json({ ok: true })
})

const port = Number(process.env.PORT ?? 3000)
app.listen(port, () => console.log(`API running on http://localhost:${port}`))