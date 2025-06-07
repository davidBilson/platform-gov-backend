import express from 'express';
import {
  getNotifications,
  markAsRead,
  markAllAsRead,
  getUnreadCount,
  deleteNotification
} from '../controllers/notification.controller.js';

const router = express.Router();

router.get('/get-notifications/:id', getNotifications);
router.put('/:id/read', markAsRead);
router.put('/read-all', markAllAsRead);
router.get('/unread-count', getUnreadCount);
router.delete('/delete/:id', deleteNotification);

export default router;