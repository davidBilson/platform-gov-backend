import mongoose from 'mongoose';

const contractSchema = new mongoose.Schema({
  hiringId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Hiring',
    required: true,
    unique: true
  },
  
  jobId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Jobs',
  },
  contractorId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
  },
  clientId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
  },
  
  startDate: {
    type: Date,
    default: Date.now
  },

  endDate: Date,
  
  status: {
    type: String,
    enum: ['active', 'paused', 'completed', 'cancelled', 'disputed'],
    default: 'active'
  },
  
  paymentStructure: {
    type: String,
    enum: ['milestone', 'timesheet', 'retainer'],
  },
  
  milestones: [{
    name: {
      type: String,
    },
    description: String,
    dueDate: Date,
    amount: {
      type: Number,
    },
    status: {
      type: String,
      enum: ['pending', 'completed', 'approved', 'paid', 'disputed'],
      default: 'pending'
    },
    completionDate: Date,
    paymentDate: Date,
    clientApproved: {
      type: Boolean,
    },
    createdAt: {
      type: Date,
      default: Date.now
    },
    updatedAt: {
      type: Date,
      default: Date.now
    },
    _id: {
      type: mongoose.Schema.Types.ObjectId,
      default: () => new mongoose.Types.ObjectId()
    }
  }],
  
  timesheets: [{
    // Session tracking fields
    startTime: {
      type: Date,
      required: true
    },
    endTime: Date,
    duration: { // in seconds
      type: Number,
      min: 0
    },
    
    // Screenshot tracking
    screenshots: [{
      imagePath: {
        type: String,
        required: true
      },
      publicId: {
        type: String,
        required: true
      },
      uploadedAt: {
        type: Date,
        default: Date.now
      }
    }],
    
    // Status and approval
    status: {
      type: String,
      enum: ['active', 'pending', 'approved', 'disputed', 'paid'],
      default: 'pending'
    },
    notes: String,
    
    // Financial information
    rate: {
      type: Number,
      min: 0
    },
    amount: {
      type: Number,
      min: 0
    },
    
    // Approval tracking
    approvedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    approvedAt: Date,
    
    // Dispute tracking
    disputeReason: String,
    disputedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    disputedAt: Date,
    
    // Payment tracking
    paymentDate: Date,
    
    // Timestamps
    createdAt: {
      type: Date,
      default: Date.now
    },
    updatedAt: {
      type: Date,
      default: Date.now
    },
    _id: {
      type: mongoose.Schema.Types.ObjectId,
      default: () => new mongoose.Types.ObjectId()
    }
  }],
  
  retainer: {
    recurringAmount: {
      type: Number,
    },
    frequency: {
      type: String,
      enum: ['weekly', 'bi-weekly', 'monthly'],
    },
    nextPaymentDate: Date,
    lastPaymentDate: Date,
    paymentHistory: [{
      amount: Number,
      paymentDate: Date,
      periodStart: Date,
      periodEnd: Date,
      transactionId: String,
      status: {
        type: String,
        enum: ['pending', 'completed', 'failed'],
        default: 'pending'
      }
    }],
    startDate: Date,
    workSummaries: [{
      text: String,
      submittedAt: Date,
      forPeriod: Date,
      _id: {
        type: mongoose.Schema.Types.ObjectId,
        default: () => new mongoose.Types.ObjectId()
      }
    }],
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

contractSchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  next();
});

const Contract = mongoose.model('Contract', contractSchema);
export default Contract;