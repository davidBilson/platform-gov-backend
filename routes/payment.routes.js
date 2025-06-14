import express from 'express';
import { savePaymentMethod, fundProject } from '../controllers/payment.controller.js';

const router = express.Router();

router.post('/save-method', savePaymentMethod);

router.post('/fund-project', fundProject);

export default router;