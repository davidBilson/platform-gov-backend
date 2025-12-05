import express from 'express';
import adminRoutes from './admin.routes.js';
import paymentRoutes from './payment.routes.js';
import subscriptionRoutes from './subscription.routes.js';
import contentRoutes from './content.routes.js';
import authRoutes from './auth.routes.js';
import profileRoutes from './profile.routes.js';
import jobRoutes from './job.routes.js';
import hiringRoutes from './hiring.routes.js';
import statusRoutes from './status.routes.js';
import chatRoutes from './chat.routes.js';
import notificationRoutes from './notification.routes.js';
import contractRoutes from './contract.routes.js';
import milestoneRoutes from './milestone.routes.js';
import timesheetRoutes from './timesheet.routes.js';
import retainerRoutes from './retainer.routes.js';
import ratingRoutes from './rating.routes.js';
import vettingRoutes from './vetting.routes.js';

const router = express.Router();

router.use('/admin', adminRoutes);

router.use('/payment', paymentRoutes);

router.use('/subscription', subscriptionRoutes);

router.use('/content', contentRoutes);

router.use('/auth', authRoutes);

router.use('/profile', profileRoutes);

router.use('/job', jobRoutes);

router.use('/hiring', hiringRoutes);

router.use('/status', statusRoutes);

router.use('/chat', chatRoutes);

router.use('/notifications', notificationRoutes);

router.use('/contract', contractRoutes);

router.use('/milestone', milestoneRoutes);

router.use('/timesheet', timesheetRoutes);

router.use('/retainer', retainerRoutes);

router.use('/rating', ratingRoutes);

router.use('/vetting', vettingRoutes);

export default router;