import { Message, MessageThread } from '../models/messaging.system.model.js';

export const getMessages = async (req, res) => {
  try {
    const hiringId = req.params.id;

    console.log("hit getMessages")

    const messages = await Message.find({ threadId: hiringId })
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
    const hiringId = req.params.id;
    const { senderId, recipientId, content } = req.body;

    const newMessage = new Message({
      threadId: hiringId,
      sender: senderId,
      recipient: recipientId,
      content: content
    });
    
    const savedMessage = await newMessage.save();
    console.log('Message saved:', savedMessage);

    await MessageThread.findByIdAndUpdate(
      hiringId,
      { lastMessage: new Date() }
    );

    // Populate sender/recipient before returning
    const populatedMessage = await Message.populate(savedMessage, [
      { path: 'sender', select: 'name profilePicture' },
      { path: 'recipient', select: 'name profilePicture' }
    ]);

    // Broadcast to all clients in the room
    req.app.get('io').to(hiringId).emit('receive-message', populatedMessage);

    res.status(201).json(populatedMessage);
  } catch (error) {
    console.error('Error sending message:', error);
    res.status(500).json({ message: error.message });
  }
};

export const getOrCreateThread = async (req, res) => {
  try {
    const { hiringId, clientId, contractorId, jobId } = req.body;

    console.log("hit getOrCreateThread")

    let thread = await MessageThread.findOne({ 
      _id: hiringId 
    });

    if (!thread) {
      thread = new MessageThread({
        _id: hiringId,
        participants: [clientId, contractorId],
        jobId,
        contractId: hiringId
      });
      await thread.save();
    }

    res.json(thread);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};