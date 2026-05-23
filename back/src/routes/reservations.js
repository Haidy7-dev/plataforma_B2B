import express from 'express'
import { requireRole } from '../middleware/requireRole.js'
import { authJwt } from '../middleware/authJwt.js'
import { dataStore } from '../services/dataStore.js'

export const reservationsRouter = express.Router()

reservationsRouter.use(authJwt)
reservationsRouter.use(requireRole(['gestor']))

reservationsRouter.get('/upcoming', (req, res) => {
  res.json({ events: dataStore.upcomingEvents })
})

