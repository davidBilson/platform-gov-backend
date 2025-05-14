import express from 'express';
import { getMessages, getOrCreateThread, sendMessage, getUserConversations, markMessagesAsRead } from '../controllers/chat.controller.js';

const router = express.Router();

router.get('/job/:jobId/proposal/:proposalId/messages', getMessages);
router.post('/job/:jobId/proposal/:proposalId/messages', sendMessage);
router.post('/thread', getOrCreateThread);

router.put('/thread/:threadId/read/:userId', markMessagesAsRead);

router.get('/user/conversations/:id', getUserConversations);

export default router;