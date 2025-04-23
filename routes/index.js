import express from 'express';
import authRoutes from './auth.routes.js';
import profileRoutes from './profile.routes.js';
import jobRoutes from './job.routes.js';

const router = express.Router();

router.use('/auth', authRoutes);

router.use('/profile', profileRoutes);

router.use('/job', jobRoutes);

export default router;