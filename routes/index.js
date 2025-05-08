import express from 'express';
import authRoutes from './auth.routes.js';
import profileRoutes from './profile.routes.js';
import jobRoutes from './job.routes.js';
import hiringRoutes from './hiring.routes.js';
import statusRoutes from './status.routes.js';

const router = express.Router();

router.use('/auth', authRoutes);

router.use('/profile', profileRoutes);

router.use('/job', jobRoutes);

router.use('/hiring', hiringRoutes);

router.use('/status', statusRoutes);

export default router;