
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

    io.to(userId.toString()).emit('new-notification', {
      ...savedNotification.toObject(), // Use actual document
      createdAt: new Date()
    });
    
    // Emit to user's personal room
    io.to(userId.toString()).emit('new-notification', {
      ...data,
      _id: Math.random().toString(36).substr(2, 9),
      createdAt: new Date()
    });
    
    return notification;
  } catch (error) {
    console.error('Error creating notification:', error);
  }
};

// Watch for relevant events and emit notifications
export const setupNotificationWatchers = (io) => {
  // Watch User collection for new users
  User.watch().on('change', async (change) => {
    if (change.operationType === 'insert') {
      const newUser = change.fullDocument;
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
      await createNotification(io, {
        userId: newRating.reviewee,
        title: 'New Rating Received',
        message: `You received a ${newRating.rating}-star rating from ${newRating.reviewer.name || 'a user'}`,
        type: 'new_rating',
        link: `/profile/${newRating.reviewee}/ratings`
      });
    }
  });

  // Watch Message collection for new messages
  Message.watch().on('change', async (change) => {
    if (change.operationType === 'insert') {
      const newMessage = change.fullDocument;
      await createNotification(io, {
        userId: newMessage.recipient,
        title: 'New Message',
        message: `You have a new message from ${newMessage.sender.name || 'a user'}`,
        type: 'new_message',
        link: `/messages/${newMessage.threadId}`
      });
    }
  });

  // Watch JobApplication for status changes
  JobApplication.watch().on('change', async (change) => {
    if (change.operationType === 'update' && change.updateDescription.updatedFields.status) {
      const updatedApp = change.fullDocument;
      const status = change.updateDescription.updatedFields.status;
      
      if (status === 'viewed') {
        await createNotification(io, {
          userId: updatedApp.freelancerId,
          title: 'Application Viewed',
          message: `Your application for job "${updatedApp.jobId.jobTitle}" was viewed by the client`,
          type: 'application_viewed',
          link: `/jobs/${updatedApp.jobId}`
        });
      }
      
      if (status === 'active') {
        await createNotification(io, {
          userId: updatedApp.freelancerId,
          title: 'Application Active',
          message: `Your application for job "${updatedApp.jobId.jobTitle}" is now active`,
          type: 'application_active',
          link: `/jobs/${updatedApp.jobId}`
        });
      }
    }
  });

  // Watch Hiring for status changes
  Hiring.watch().on('change', async (change) => {
    if (change.operationType === 'insert') {
      const newHiring = change.fullDocument;
      await createNotification(io, {
        userId: newHiring.contractorId,
        title: 'New Offer Received',
        message: `You have a new job offer from ${newHiring.clientId.name || 'a client'}`,
        type: 'offer_received',
        link: `/contracts/${newHiring._id}`
      });
    }
    
    if (change.operationType === 'update' && change.updateDescription.updatedFields.status) {
      const updatedHiring = change.fullDocument;
      const status = change.updateDescription.updatedFields.status;
      
      if (status === 'accepted') {
        await createNotification(io, {
          userId: updatedHiring.clientId,
          title: 'Offer Accepted',
          message: `Your offer to ${updatedHiring.contractorId.name || 'a contractor'} was accepted`,
          type: 'offer_accepted',
          link: `/contracts/${updatedHiring._id}`
        });
      }
      
      if (status === 'declined') {
        await createNotification(io, {
          userId: updatedHiring.clientId,
          title: 'Offer Declined',
          message: `Your offer to ${updatedHiring.contractorId.name || 'a contractor'} was declined`,
          type: 'offer_declined',
          link: `/contracts/${updatedHiring._id}`
        });
      }
    }
  });

  // Watch Contract for milestone updates
  Contract.watch().on('change', async (change) => {
    if (change.operationType === 'update' && change.updateDescription.updatedFields) {
      const contract = change.fullDocument;
      const updatedFields = change.updateDescription.updatedFields;
      
      // Check for milestone updates
      if (updatedFields.$set && updatedFields.$set['milestones.$[elem].status']) {
        const milestone = updatedFields.$set['milestones.$[elem]'];
        
        if (milestone.status === 'completed') {
          await createNotification(io, {
            userId: contract.clientId,
            title: 'Milestone Completed',
            message: `A milestone was completed by ${contract.contractorId.name || 'the contractor'}`,
            type: 'milestone_completed',
            link: `/contracts/${contract._id}`
          });
        }
        
        if (milestone.status === 'approved') {
          await createNotification(io, {
            userId: contract.contractorId,
            title: 'Milestone Approved',
            message: `Your milestone was approved by the client`,
            type: 'milestone_approved',
            link: `/contracts/${contract._id}`
          });
        }
        
        if (milestone.status === 'disputed') {
          await createNotification(io, {
            userId: contract.clientId,
            title: 'Milestone Disputed',
            message: `A milestone was disputed by ${contract.contractorId.name || 'the contractor'}`,
            type: 'milestone_disputed',
            link: `/contracts/${contract._id}`
          });
        }
      }
    }
  });
};

// API Controllers
export const getNotifications = async (req, res) => {
  try {
    const userId = req.params.id;
    console.log('Fetching notifications for user:', userId);
    const notifications = await Notification.find({ userId })
      .sort({ createdAt: -1 });
    
    res.json(notifications);
  } catch (error) {
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
    
    res.json(notification);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

export const markAllAsRead = async (req, res) => {
  try {
    const userId = req.user._id;
    await Notification.updateMany(
      { userId, isRead: false },
      { $set: { isRead: true } }
    );
    
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

export const getUnreadCount = async (req, res) => {
  try {
    const userId = req.user._id;
    const count = await Notification.countDocuments({ 
      userId, 
      isRead: false 
    });
    
    res.json({ count });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

export const deleteNotification = async (req, res) => {
  try {
    const { id } = req.params;
    await Notification.findByIdAndDelete(id);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};