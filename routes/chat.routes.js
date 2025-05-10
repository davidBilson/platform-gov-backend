import express from 'express';
import { getMessages, getOrCreateThread, sendMessage } from '../controllers/chat.controller.js';

const router = express.Router();
// :id is hiring id
router.get('/hiring/:id/messages', getMessages);
router.post('/hiring/:id/messages', sendMessage); // New endpoint
router.post('/thread', getOrCreateThread);


export default router;