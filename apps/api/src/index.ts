import 'dotenv/config'
import { app } from './app.js'
import { startEmailWorker } from './email/queue.js'

const port = Number(process.env.PORT ?? 3000)
app.listen(port, () => console.log(`API running on http://localhost:${port}`))
startEmailWorker()