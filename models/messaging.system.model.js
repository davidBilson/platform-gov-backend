import mongoose from 'mongoose';

const messageSchema = new mongoose.Schema({
  threadId: {
    type: String,
    required: true,
    index: true
  },
  sender: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  recipient: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  content: {
    type: String,
    required: true,
  },
  encryptedContent: {
    type: String
  },
  iv: {
    type: String
  },
  attachments: [{
    filename: String,
    originalName: String,
    fileSize: Number,
    fileType: String,
    fileUrl: String
  }],
  isRead: {
    type: Boolean,
    default: false
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

const messageThreadSchema = new mongoose.Schema({
  _id: {
    type: String
  },
  participants: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  }],
  jobId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Jobs'
  },
  applicationId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'JobApplications'
  },
  contractId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Contract'
  },
  lastMessage: {
    type: Date,
    default: Date.now
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true
});

messageThreadSchema.index({ participants: 1 });
messageThreadSchema.index({ jobId: 1 });
messageThreadSchema.index({ applicationId: 1 });
messageThreadSchema.index({ contractId: 1 });
messageThreadSchema.index({ lastMessage: -1 });

const Message = mongoose.model('Message', messageSchema);
const MessageThread = mongoose.model('MessageThread', messageThreadSchema);

export { Message, MessageThread };