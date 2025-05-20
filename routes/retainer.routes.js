import express from 'express';
import { startRetainer, submitWorkSummary, getRetainerDetails } from '../controllers/contract/retainer.controller.js';

const router = express.Router();

router.put('/:id/retainer/start', startRetainer);
router.post('/:id/retainer/submit-summary', submitWorkSummary);
router.get('/:id/retainer', getRetainerDetails);

export default router;