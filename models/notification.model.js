import mongoose from 'mongoose';

const notificationSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  title: {
    type: String,
    required: true,
    trim: true,
    maxlength: 50
  },
  message: {
    type: String,
    required: true,
    trim: true,
    maxlength: 100
  },
  type: {
    type: String,
    enum: [
      'welcome', 
      'new_rating', 
      'new_message', 
      'application_viewed', 
      'application_active',
      'offer_received',
      'offer_accepted',
      'offer_declined',
      'milestone_completed',
      'milestone_approved',
      'milestone_disputed',
      'contract_started',
      'contract_ended',
      'payment_processed',
      'security_alert'
    ],
    required: true
  },
  isRead: {
    type: Boolean,
    default: false
  },
  link: {
    type: String,
    trim: true
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

notificationSchema.index({ userId: 1, isRead: 1 });
notificationSchema.index({ createdAt: -1 });

const Notification = mongoose.model('Notification', notificationSchema);

export default Notification;