import { Message, MessageThread } from '../models/messaging.system.model.js';

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
    const { senderId, recipientId, content } = req.body;
    const threadId = `${jobId}-${proposalId}`;

    const newMessage = new Message({
      threadId,
      sender: senderId,
      recipient: recipientId,
      content: content
    });
    
    const savedMessage = await newMessage.save();

    await MessageThread.findOneAndUpdate(
      { _id: threadId },
      { lastMessage: new Date() },
      { upsert: true, new: true }
    );

    const populatedMessage = await Message.populate(savedMessage, [
      { path: 'sender', select: 'name profilePicture' },
      { path: 'recipient', select: 'name profilePicture' }
    ]);

    req.app.get('io').to(threadId).emit('receive-message', populatedMessage);

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

    let thread = await MessageThread.findOne({ 
      _id: threadId 
    });

    if (!thread) {
      thread = new MessageThread({
        _id: threadId,
        participants: [clientId, contractorId],
        jobId,
        applicationId: proposalId
      });
      await thread.save();
    }

    res.json(thread);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};