import express from 'express'
import { requireRole } from '../middleware/requireRole.js'
import { authJwt } from '../middleware/authJwt.js'
import { dataStore } from '../services/dataStore.js'

export const logisticsRouter = express.Router()

logisticsRouter.use(authJwt)
logisticsRouter.use(requireRole(['logist']))

logisticsRouter.get('/preparation-list', (req, res) => {
  res.json({ list: dataStore.preparationList })
})

