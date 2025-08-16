import express from 'express';
import { cancelSubscription, checkSubscriptionStatus, resumeSubscription, subscribe, fetchSubscriptionPrices, fetchTips } from '../controllers/subscription.controller.js';

const router = express.Router();

router.post('/subscribe', subscribe);

router.patch('/cancel', cancelSubscription);

router.patch('/resume', resumeSubscription);

router.get('/check-subscription-status', checkSubscriptionStatus);

router.get('/fetch-subscription-prices', fetchSubscriptionPrices)

router.get('/get-tips', fetchTips);


export default router;