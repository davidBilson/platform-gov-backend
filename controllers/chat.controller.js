// controllers/chat.controller.js (updated)
import { Message, MessageThread } from '../models/messaging.system.model.js';
import mongoose from 'mongoose';

export const getMessages = async (req, res) => {
  try {
    const { jobId, proposalId } = req.params;
    const threadId = `${jobId}-${proposalId}`;

    const messages = await Message.find({ threadId })
      .sort({ createdAt: 1 })
      .populate('sender', 'name profilePicture')
      .populate('recipient', 'name profilePicture');

    res.json(messages);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

export const sendMessage = async (req, res) => {
  try {
    const { jobId, proposalId } = req.params;
    const { senderId, recipientId, content, encryptedContent, iv } = req.body;
    const threadId = `${jobId}-${proposalId}`;

    // Create or update thread with participants
    await MessageThread.findOneAndUpdate(
      { _id: threadId },
      { 
        $set: { 
          lastMessage: new Date(),
          jobId,
          applicationId: proposalId
        },
        $addToSet: { 
          participants: { $each: [senderId, recipientId] } 
        }
      },
      { upsert: true, new: true }
    );

    const newMessage = new Message({
      threadId,
      sender: senderId,
      recipient: recipientId,
      content: content,
      encryptedContent: encryptedContent,
      iv: iv
    });
    
    const savedMessage = await newMessage.save();
    const populatedMessage = await Message.populate(savedMessage, [
      { path: 'sender', select: 'name profilePicture' },
      { path: 'recipient', select: 'name profilePicture' }
    ]);

    // Emit to both the chat room and specific users
    const io = req.app.get('io');
    
    // Emit to the chat room
    io.to(threadId).emit('receive-message', populatedMessage);
    
    // Emit to sender with isCurrentUser: true
    io.to(senderId.toString()).emit('conversation-update', {
      threadId,
      message: populatedMessage,
      isCurrentUser: true,
      unreadCount: 0 // Sender's messages are always read
    });
    
    // Emit to recipient with isCurrentUser: false
    io.to(recipientId.toString()).emit('conversation-update', {
      threadId,
      message: populatedMessage,
      isCurrentUser: false,
      unreadCount: 1 // Increment unread count for recipient
    });

    res.status(201).json(populatedMessage);

  } catch (error) {
    console.error('Error sending message:', error);
    res.status(500).json({ message: error.message });
  }
};

export const getOrCreateThread = async (req, res) => {
  try {
    const { jobId, proposalId, clientId, contractorId } = req.body;
    const threadId = `${jobId}-${proposalId}`;

    let thread = await MessageThread.findOneAndUpdate(
      { _id: threadId },
      { 
        $set: { jobId, applicationId: proposalId },
        $addToSet: { participants: { $each: [clientId, contractorId] } }
      },
      { upsert: true, new: true }
    );

    res.json(thread);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

export const getUserConversations = async (req, res) => {
  try {
    const userId = req.params.id;

    if (!userId || !mongoose.Types.ObjectId.isValid(userId.toString())) {
      return res.status(400).json({ message: 'Valid user ID is required' });
    }

    // Get all threads where user is a participant
    const threads = await MessageThread.find({
      participants: userId
    })
    .populate({
      path: 'participants',
      select: 'name',
      model: 'User'
    })
    .populate({
      path: 'jobId',
      select: 'jobTitle',
      model: 'Jobs'
    })
    .sort({ lastMessage: -1 });

    // Get conversation details for each thread
    const conversations = await Promise.all(
      threads.map(async (thread) => {
        // Find the other participant
        const otherParticipant = thread.participants.find(
          (p) => p._id.toString() !== userId.toString()
        );

        // Get last message
        const lastMessage = await Message.findOne({ threadId: thread._id })
          .sort({ createdAt: -1 })
          .lean();

        // Count unread messages
        const unreadCount = await Message.countDocuments({
          threadId: thread._id,
          recipient: userId,
          isRead: false
        });

        return {
          threadId: thread._id,
          jobId: thread.jobId?._id,
          jobTitle: thread.jobId?.jobTitle,
          otherUser: {
            id: otherParticipant?._id,
            name: otherParticipant?.name || 'Unknown User',
          },
          lastMessage: {
            content: lastMessage?.content || 'No messages yet',
            isCurrentUser: lastMessage?.sender.toString() === userId.toString(),
            createdAt: lastMessage?.createdAt || thread.createdAt
          },
          unreadCount
        };
      })
    );

    // Add GovLink as first conversation
    conversations.unshift({
      threadId: 'govlink',
      otherUser: {
        id: new mongoose.Types.ObjectId(),
        name: 'GovLink'
      },
      lastMessage: {
        content: 'Official government communications',
        isCurrentUser: false,
        createdAt: new Date()
      },
      unreadCount: 0
    });

    res.json({
      count: conversations.length - 1,
      conversations
    });
  } catch (error) {
    console.error('Error fetching conversations:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
};

export const markMessagesAsRead = async (req, res) => {
  try {
    const { threadId, userId } = req.params;
    
    if (!threadId || !userId) {
      return res.status(400).json({ message: 'ThreadId and userId are required' });
    }

    // Update all unread messages where this user is the recipient
    const result = await Message.updateMany(
      { 
        threadId: threadId,
        recipient: userId,
        isRead: false
      },
      { 
        $set: { isRead: true } 
      }
    );

    res.json({ 
      success: true, 
      messagesUpdated: result.modifiedCount 
    });
  } catch (error) {
    console.error('Error marking messages as read:', error);
    res.status(500).json({ message: error.message });
  }
};