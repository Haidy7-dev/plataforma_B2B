import express from 'express'
import cors from 'cors'
import 'dotenv/config'
import { router } from './routes/index.js'

const app = express()

app.use(cors())
app.use(express.json({ limit: '10mb' }))

app.get('/health', (req, res) => res.json({ ok: true }))
app.use('/', router)

const PORT = process.env.PORT || 4000
app.listen(PORT, () => {
  console.log(`API running on http://localhost:${PORT}`)
})

