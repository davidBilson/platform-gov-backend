import express from 'express';
import { getMessages, getOrCreateThread, sendMessage, getUserConversations } from '../controllers/chat.controller.js';

const router = express.Router();

router.get('/job/:jobId/proposal/:proposalId/messages', getMessages);
router.post('/job/:jobId/proposal/:proposalId/messages', sendMessage);
router.post('/thread', getOrCreateThread);

router.get('/user/conversations/:id', getUserConversations);

export default router;