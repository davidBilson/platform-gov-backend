import express from 'express';
import { cancelSubscription, checkSubscriptionStatus, resumeSubscription, subscribe } from '../controllers/subscription.controller.js';

const router = express.Router();

router.post('/subscribe', subscribe);

router.patch('/cancel', cancelSubscription);

router.patch('/resume-subscription', resumeSubscription);

router.get('/check-subscription-status', checkSubscriptionStatus);

export default router;