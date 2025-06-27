import Notification from '../models/notification.model.js';
import User from '../models/user.model.js';
import Rating from '../models/rating.model.js';
import { Message } from '../models/messaging.system.model.js';
import Hiring from '../models/hiring.model.js';
import Contract from '../models/contract.model.js';
import JobApplication from '../models/job.applications.model.js';
import Job from '../models/job.created.model.js';
import { truncateDescription } from '../utils/truncateDescription.js';

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
    const notificationData = {
      ...savedNotification.toObject(),
      id: savedNotification._id.toString(),
      createdAt: savedNotification.createdAt
    };
    
    // Emit to user's personal room
    io.to(userId.toString()).emit('new-notification', notificationData);
    
    console.log(`Notification sent to user ${userId}:`, notificationData.title);
    return savedNotification;
  } catch (error) {
    console.error('Error creating notification:', error);
    throw error;
  }
};

let activeWatchers = new Set();

export const setupNotificationWatchers = (io) => {
  // Prevent duplicate watchers
  if (activeWatchers.size > 0) {
    console.log('Notification watchers already active');
    return;
  }

  console.log('Setting up notification watchers...');
  
  // Watch User collection for new users
  const userWatcher = User.watch([], { 
    fullDocument: 'updateLookup',
    fullDocumentBeforeChange: 'whenAvailable'
  });
  
  userWatcher.on('change', async (change) => {
    if (change.operationType === 'insert') {
      const newUser = change.fullDocument;
      
      try {
        await createNotification(io, {
          userId: newUser._id,
          title: 'Welcome to GovLink!',
          message: 'Thank you for joining our platform. Get started by completing your profile.',
          type: 'welcome',
          link: '/profile'
        });
      } catch (error) {
        console.error('Error processing welcome notification:', error);
      }
    }
  });
  activeWatchers.add('user');

  // Watch Rating collection - REMOVED $lookup, fetch data separately
  const ratingWatcher = Rating.watch([
    {
      $match: {
        operationType: 'insert'
      }
    }
  ], { fullDocument: 'updateLookup' });

  ratingWatcher.on('change', async (change) => {
    if (change.operationType === 'insert') {
      const newRating = change.fullDocument;
      
      try {
        // Fetch reviewer data separately
        const reviewer = await User.findById(newRating.reviewer).select('name');
        const reviewerName = reviewer?.name || 'a user';
        
        await createNotification(io, {
          userId: newRating.reviewee,
          title: 'New Rating Received',
          message: `You received a ${newRating.rating}-star rating from ${reviewerName}`,
          type: 'new_rating',
          link: `/profile/${newRating.reviewee}/ratings`
        });
      } catch (error) {
        console.error('Error processing rating notification:', error);
      }
    }
  });
  activeWatchers.add('rating');

  // Watch Message collection - REMOVED $lookup, fetch data separately
  const messageWatcher = Message.watch([
    {
      $match: {
        operationType: 'insert'
      }
    }
  ], { fullDocument: 'updateLookup' });

  messageWatcher.on('change', async (change) => {
    if (change.operationType === 'insert') {
      const newMessage = change.fullDocument;
      
      try {
        // Fetch sender data separately
        const sender = await User.findById(newMessage.sender).select('name');
        const senderName = sender?.name || 'a user';
        
        await createNotification(io, {
          userId: newMessage.recipient,
          title: 'New Message',
          message: `You have a new message from ${senderName}`,
          type: 'new_message',
          link: `/messages`
        });
      } catch (error) {
        console.error('Error processing message notification:', error);
      }
    }
  });
  activeWatchers.add('message');

  const jobApplicationWatcher = JobApplication.watch([
    {
      $match: {
        $or: [
          { operationType: 'insert' },
          { 
            operationType: 'update',
            'updateDescription.updatedFields.status': { $exists: true }
          }
        ]
      }
    }
  ], { fullDocument: 'updateLookup' });

  jobApplicationWatcher.on('change', async (change) => {
    try {
      const application = change.fullDocument;

      if (change.operationType === 'insert') {
        // Skip draft applications
        if (application.status === 'draft') return;
        
        // Fetch related data separately
        const [jobData, freelancerData] = await Promise.all([
          Job.findById(application.jobId).select('jobTitle userId'),
          User.findById(application.freelancerId).select('name')
        ]);

        const clientId = jobData?.userId;
        if (clientId) {
          await createNotification(io, {
            userId: clientId,
            title: 'New Job Application',
            message: `${freelancerData?.name || 'A freelancer'} applied for your job "${jobData?.jobTitle || 'your job'}"`,
            type: 'new_application',
            link: `/jobs/${jobData?._id}/applications`
          });
        }
      }

      if (change.operationType === 'update') {
        const status = change.updateDescription?.updatedFields?.status;
        
        if (status === 'viewed' || status === 'active') {
          // Fetch job data separately
          const jobData = await Job.findById(application.jobId).select('jobTitle');
          
          if (status === 'viewed') {
            await createNotification(io, {
              userId: application.freelancerId,
              title: 'Application Viewed',
              message: `Your application for job "${truncateDescription(jobData?.jobTitle, 99) || 'a job'}" was viewed by the client`,
              type: 'application_viewed',
              link: `/jobs/${jobData?._id}`
            });
          }
          
          if (status === 'active') {
            await createNotification(io, {
              userId: application.freelancerId,
              title: 'Application Active',
              message: `Your application for job "${jobData?.jobTitle || 'a job'}" is now active`,
              type: 'application_active',
              link: `/jobs/${jobData?._id}`
            });
          }
        }
      }
    } catch (error) {
      console.error('Error processing job application notification:', error);
    }
  });
  activeWatchers.add('jobapplication');

  // Watch Hiring - REMOVED $lookup, fetch data separately
  const hiringWatcher = Hiring.watch([
    {
      $match: {
        $or: [
          { operationType: 'insert' },
          { 
            operationType: 'update',
            'updateDescription.updatedFields.status': { $exists: true }
          }
        ]
      }
    }
  ], { fullDocument: 'updateLookup' });

  hiringWatcher.on('change', async (change) => {
    try {
      const hiring = change.fullDocument;

      if (change.operationType === 'insert') {
        // Fetch client data separately
        const clientData = await User.findById(hiring.clientId).select('name');
        
        await createNotification(io, {
          userId: hiring.contractorId,
          title: 'New Offer Received',
          message: `You have a new job offer from ${clientData?.name || 'a client'}`,
          type: 'offer_received',
          link: `/contracts/${hiring._id}`
        });
      }
      
      if (change.operationType === 'update') {
        const status = change.updateDescription?.updatedFields?.status;
        
        if (status === 'accepted' || status === 'declined') {
          // Fetch contractor data separately
          const contractorData = await User.findById(hiring.contractorId).select('name');
          
          if (status === 'accepted') {
            await createNotification(io, {
              userId: hiring.clientId,
              title: 'Offer Accepted',
              message: `Your offer to ${contractorData?.name || 'a contractor'} was accepted`,
              type: 'offer_accepted',
              link: `/contracts/${hiring._id}`
            });
          }
          
          if (status === 'declined') {
            await createNotification(io, {
              userId: hiring.clientId,
              title: 'Offer Declined',
              message: `Your offer to ${contractorData?.name || 'a contractor'} was declined`,
              type: 'offer_declined',
              link: `/contracts/${hiring._id}`
            });
          }
        }
      }
    } catch (error) {
      console.error('Error processing hiring notification:', error);
    }
  });
  activeWatchers.add('hiring');

  // Watch Contract for milestone updates - REMOVED $lookup, fetch data separately
  const contractWatcher = Contract.watch([
    {
      $match: {
        operationType: 'update',
        'updateDescription.updatedFields': { $exists: true }
      }
    }
  ], { fullDocument: 'updateLookup' });

  contractWatcher.on('change', async (change) => {
    try {
      const contract = change.fullDocument;
      const updatedFields = change.updateDescription?.updatedFields;
      
      // Check for milestone updates
      for (const [key, value] of Object.entries(updatedFields)) {
        if (key.includes('milestones') && key.includes('status')) {
          // Fetch user data separately when needed
          if (value === 'completed') {
            const contractorData = await User.findById(contract.contractorId).select('name');
            
            await createNotification(io, {
              userId: contract.clientId,
              title: 'Milestone Completed',
              message: `A milestone was completed by ${contractorData?.name || 'the contractor'}`,
              type: 'milestone_completed',
              link: `/contracts/${contract._id}`
            });
          }
          
          if (value === 'approved') {
            await createNotification(io, {
              userId: contract.contractorId,
              title: 'Milestone Approved',
              message: `Your milestone was approved by the client`,
              type: 'milestone_approved',
              link: `/contracts/${contract._id}`
            });
          }
          
          if (value === 'disputed') {
            const contractorData = await User.findById(contract.contractorId).select('name');
            
            await createNotification(io, {
              userId: contract.clientId,
              title: 'Milestone Disputed',
              message: `A milestone was disputed by ${contractorData?.name || 'the contractor'}`,
              type: 'milestone_disputed',
              link: `/contracts/${contract._id}`
            });
          }
        }
      }
    } catch (error) {
      console.error('Error processing contract notification:', error);
    }
  });
  activeWatchers.add('contract');

  console.log(`Set up ${activeWatchers.size} notification watchers`);
};

// Clean up watchers on server shutdown
export const cleanupWatchers = () => {
  console.log('Cleaning up notification watchers...');
  activeWatchers.clear();
};

export const getNotifications = async (req, res) => {
  try {
    const userId = req.params.id;
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