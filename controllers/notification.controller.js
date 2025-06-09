import Notification from '../models/notification.model.js';
import User from '../models/user.model.js';
import Rating from '../models/rating.model.js';
import { Message } from '../models/messaging.system.model.js';
import Hiring from '../models/hiring.model.js';
import Contract from '../models/contract.model.js';
import JobApplication from '../models/job.applications.model.js';

// Helper to create and emit notification
const createNotification = async (io, { userId, title, message, type, link = null }) => {
  try {
    const notification = new Notification({
      userId,
      title,
      message,
      type,
      link
    });
    
    const savedNotification = await notification.save();
    
    // Emit to user's personal room with the actual saved notification
    io.to(userId.toString()).emit('new-notification', {
      ...savedNotification.toObject(),
      id: savedNotification._id.toString(), // Ensure ID is available
      createdAt: savedNotification.createdAt
    });
    
    console.log(`Notification emitted to user ${userId}:`, savedNotification.title);
    
    return savedNotification;
  } catch (error) {
    console.error('Error creating notification:', error);
    throw error;
  }
};

// Watch for relevant events and emit notifications
export const setupNotificationWatchers = (io) => {
  console.log('Setting up notification watchers...');
  
  // Watch User collection for new users
  User.watch().on('change', async (change) => {
    if (change.operationType === 'insert') {
      const newUser = change.fullDocument;
      console.log('New user registered:', newUser._id);
      
      await createNotification(io, {
        userId: newUser._id,
        title: 'Welcome to GovLink!',
        message: 'Thank you for joining our platform. Get started by completing your profile.',
        type: 'welcome',
        link: '/profile'
      });
    }
  });

  // Watch Rating collection for new ratings
  Rating.watch().on('change', async (change) => {
    if (change.operationType === 'insert') {
      const newRating = change.fullDocument;
      
      // Populate reviewer data if needed
      await Rating.populate(newRating, { path: 'reviewer', select: 'name' });
      
      await createNotification(io, {
        userId: newRating.reviewee,
        title: 'New Rating Received',
        message: `You received a ${newRating.rating}-star rating from ${newRating.reviewer?.name || 'a user'}`,
        type: 'new_rating',
        link: `/profile/${newRating.reviewee}/ratings`
      });
    }
  });

  // Watch Message collection for new messages
  Message.watch().on('change', async (change) => {
    if (change.operationType === 'insert') {
      const newMessage = change.fullDocument;
      
      // Populate sender data if needed
      await Message.populate(newMessage, { path: 'sender', select: 'name' });
      
      await createNotification(io, {
        userId: newMessage.recipient,
        title: 'New Message',
        message: `You have a new message from ${newMessage.sender?.name || 'a user'}`,
        type: 'new_message',
        link: `/messages/${newMessage.threadId}`
      });
    }
  });

  // Watch JobApplication for status changes
  JobApplication.watch().on('change', async (change) => {
    if (change.operationType === 'update' && change.updateDescription?.updatedFields?.status) {
      const updatedApp = change.fullDocument;
      const status = change.updateDescription.updatedFields.status;
      
      // Populate job data if needed
      await JobApplication.populate(updatedApp, { path: 'jobId', select: 'jobTitle' });
      
      if (status === 'viewed') {
        await createNotification(io, {
          userId: updatedApp.freelancerId,
          title: 'Application Viewed',
          message: `Your application for job "${updatedApp.jobId?.jobTitle || 'a job'}" was viewed by the client`,
          type: 'application_viewed',
          link: `/jobs/${updatedApp.jobId?._id}`
        });
      }
      
      if (status === 'active') {
        await createNotification(io, {
          userId: updatedApp.freelancerId,
          title: 'Application Active',
          message: `Your application for job "${updatedApp.jobId?.jobTitle || 'a job'}" is now active`,
          type: 'application_active',
          link: `/jobs/${updatedApp.jobId?._id}`
        });
      }
    }
  });

  // Watch Hiring for status changes
  Hiring.watch().on('change', async (change) => {
    if (change.operationType === 'insert') {
      const newHiring = change.fullDocument;
      
      // Populate client data if needed
      await Hiring.populate(newHiring, { path: 'clientId', select: 'name' });
      
      await createNotification(io, {
        userId: newHiring.contractorId,
        title: 'New Offer Received',
        message: `You have a new job offer from ${newHiring.clientId?.name || 'a client'}`,
        type: 'offer_received',
        link: `/contracts/${newHiring._id}`
      });
    }
    
    if (change.operationType === 'update' && change.updateDescription?.updatedFields?.status) {
      const updatedHiring = change.fullDocument;
      const status = change.updateDescription.updatedFields.status;
      
      await Hiring.populate(updatedHiring, { path: 'contractorId', select: 'name' });
      
      if (status === 'accepted') {
        await createNotification(io, {
          userId: updatedHiring.clientId,
          title: 'Offer Accepted',
          message: `Your offer to ${updatedHiring.contractorId?.name || 'a contractor'} was accepted`,
          type: 'offer_accepted',
          link: `/contracts/${updatedHiring._id}`
        });
      }
      
      if (status === 'declined') {
        await createNotification(io, {
          userId: updatedHiring.clientId,
          title: 'Offer Declined',
          message: `Your offer to ${updatedHiring.contractorId?.name || 'a contractor'} was declined`,
          type: 'offer_declined',
          link: `/contracts/${updatedHiring._id}`
        });
      }
    }
  });

  // Watch Contract for milestone updates
  Contract.watch().on('change', async (change) => {
    if (change.operationType === 'update' && change.updateDescription?.updatedFields) {
      const contract = change.fullDocument;
      const updatedFields = change.updateDescription.updatedFields;
      
      // Populate user data if needed
      await Contract.populate(contract, [
        { path: 'clientId', select: 'name' },
        { path: 'contractorId', select: 'name' }
      ]);
      
      // Check for milestone updates
      Object.keys(updatedFields).forEach(async (key) => {
        if (key.includes('milestones') && key.includes('status')) {
          const milestoneStatus = updatedFields[key];
          
          if (milestoneStatus === 'completed') {
            await createNotification(io, {
              userId: contract.clientId,
              title: 'Milestone Completed',
              message: `A milestone was completed by ${contract.contractorId?.name || 'the contractor'}`,
              type: 'milestone_completed',
              link: `/contracts/${contract._id}`
            });
          }
          
          if (milestoneStatus === 'approved') {
            await createNotification(io, {
              userId: contract.contractorId,
              title: 'Milestone Approved',
              message: `Your milestone was approved by the client`,
              type: 'milestone_approved',
              link: `/contracts/${contract._id}`
            });
          }
          
          if (milestoneStatus === 'disputed') {
            await createNotification(io, {
              userId: contract.clientId,
              title: 'Milestone Disputed',
              message: `A milestone was disputed by ${contract.contractorId?.name || 'the contractor'}`,
              type: 'milestone_disputed',
              link: `/contracts/${contract._id}`
            });
          }
        }
      });
    }
  });
};

// API Controllers
export const getNotifications = async (req, res) => {
  try {
    const userId = req.params.id;
    console.log('Fetching notifications for user:', userId);
    const notifications = await Notification.find({ userId })
      .sort({ createdAt: -1 })
      .limit(50); // Limit to prevent large responses
    
    res.json(notifications);
  } catch (error) {
    console.error('Error fetching notifications:', error);
    res.status(500).json({ message: error.message });
  }
};

export const markAsRead = async (req, res) => {
  try {
    const { id } = req.params;
    const notification = await Notification.findByIdAndUpdate(
      id,
      { isRead: true },
      { new: true }
    );
    
    if (!notification) {
      return res.status(404).json({ message: 'Notification not found' });
    }
    
    res.json(notification);
  } catch (error) {
    console.error('Error marking notification as read:', error);
    res.status(500).json({ message: error.message });
  }
};

export const markAllAsRead = async (req, res) => {
  try {
    const { userId } = req.body; // Get userId from request body
    
    if (!userId) {
      return res.status(400).json({ message: 'User ID is required' });
    }
    
    const result = await Notification.updateMany(
      { userId, isRead: false },
      { $set: { isRead: true } }
    );
    
    res.json({ 
      success: true, 
      modifiedCount: result.modifiedCount 
    });
  } catch (error) {
    console.error('Error marking all notifications as read:', error);
    res.status(500).json({ message: error.message });
  }
};

export const getUnreadCount = async (req, res) => {
  try {
    const { userId } = req.query; // Get userId from query params
    
    if (!userId) {
      return res.status(400).json({ message: 'User ID is required' });
    }
    
    const count = await Notification.countDocuments({ 
      userId, 
      isRead: false 
    });
    
    res.json({ count });
  } catch (error) {
    console.error('Error getting unread count:', error);
    res.status(500).json({ message: error.message });
  }
};

export const deleteNotification = async (req, res) => {
  try {
    const { id } = req.params;
    const notification = await Notification.findByIdAndDelete(id);
    
    if (!notification) {
      return res.status(404).json({ message: 'Notification not found' });
    }
    
    res.json({ success: true });
  } catch (error) {
    console.error('Error deleting notification:', error);
    res.status(500).json({ message: error.message });
  }
};