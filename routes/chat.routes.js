import express from 'express';
import { getMessages, getOrCreateThread, sendMessage } from '../controllers/chat.controller.js';

const router = express.Router();

router.get('/job/:jobId/proposal/:proposalId/messages', getMessages);
router.post('/job/:jobId/proposal/:proposalId/messages', sendMessage);
router.post('/thread', getOrCreateThread);

export default router;