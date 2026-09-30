import 'dotenv/config'
import express from 'express'
import cors from 'cors'
import helmet from 'helmet'
import cookieParser from 'cookie-parser'

const app = express()
app.use(helmet())
app.use(cors({ origin: 'http://localhost:5173', credentials: true }))
app.use(express.json())
app.use(cookieParser())

app.get('/api/health', (_req, res) => {
  res.json({ ok: true })
})

const port = Number(process.env.PORT ?? 3000)
app.listen(port, () => console.log(`API running on http://localhost:${port}`))