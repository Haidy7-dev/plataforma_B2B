import express from 'express'
import { authRouter } from './auth.js'
import { adminRouter } from './admin.js'
import { superAdminRouter } from './superAdmin.js'
import { reservationsRouter } from './reservations.js'
import { logisticsRouter } from './logistics.js'

export const router = express.Router()

router.use('/auth', authRouter)
router.use('/admin', adminRouter)
router.use('/super-admin', superAdminRouter)
router.use('/gestor', reservationsRouter)
router.use('/logistica', logisticsRouter)

