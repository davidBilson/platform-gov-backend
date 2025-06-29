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

  // // // // // // \\ \\ \\ \\ \\
  isPaymentAmountConfirmed: { // contractor should confirm payment here if it tallies with agreement had on chat
    type: Boolean,
    default: false
  },
  isStarted: {
    type: Boolean,
    default: false
  },
  timeBasedPayment: {
    amount: {
      type: Number,
      min: 0,
      default: 0
    },
    isPaid: {
      type: Boolean,
      default: false
    }
  },
  // // // // // // \\ \\ \\ \\ \\

  totalEarnings: {
    type: Number,
    min: 0,
  },
  startDate: {
    type: Date,
    default: Date.now
  },

  maxHours: {
    type: Number,
    min: 0,
    default: null
  },
  
  isManual: {
    type: Boolean,
    default: false
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
    startTime: {
      type: Date,
      required: true
    },
    endTime: Date,
    duration: {
      type: Number,
      min: 0
    },
    
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