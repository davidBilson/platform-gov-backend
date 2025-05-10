import mongoose from 'mongoose';

const contractSchema = new mongoose.Schema({
  hiringId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Hiring',
    required: true,
    unique: true  // This creates an index automatically
  },
  
  // Core contract information
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
  
  // Contract duration
  startDate: {
    type: Date,
    default: Date.now
  },
  endDate: Date,
  
  // Contract status
  status: {
    type: String,
    enum: ['active', 'paused', 'completed', 'cancelled', 'disputed'],
    default: 'active'
  },
  
  // Payment structure type (determines which tracking system to use)
  paymentStructure: {
    type: String,
    enum: ['milestone', 'timesheet', 'retainer'],
  },
  
  // Milestone tracking system
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
  
  // Timesheet tracking system
  timesheets: [{
    weekStartDate: {
      type: Date,
    },
    weekEndDate: {
      type: Date,
    },
    hours: {
      type: Number,
      min: 0
    },
    rate: {
      type: Number,
    },
    totalAmount: {
      type: Number,
    },
    status: {
      type: String,
      enum: ['pending', 'approved', 'paid', 'disputed'],
      default: 'pending'
    },
    notes: String,
    approvedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    approvedAt: Date,
    paymentDate: Date,
    createdAt: {
      type: Date,
      default: Date.now
    },
    _id: {
      type: mongoose.Schema.Types.ObjectId,
      default: () => new mongoose.Types.ObjectId()
    }
  }],
  
  // Retainer tracking system
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
    }]
  },
  
  // Audit fields
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

// Update hook
contractSchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  next();
});

// Validation for payment structure consistency
contractSchema.pre('save', function(next) {
  if (this.paymentStructure === 'milestone' && (!this.milestones || this.milestones.length === 0)) {
    throw new Error('Milestone payment structure requires at least one milestone');
  }
  if (this.paymentStructure === 'timesheet' && this.timesheets && this.timesheets.some(ts => ts.hours <= 0)) {
    throw new Error('Timesheet entries must have positive hours');
  }
  if (this.paymentStructure === 'retainer' && !this.retainer?.recurringAmount) {
    throw new Error('Retainer payment structure requires a recurring amount');
  }
  next();
});

const Contract = mongoose.model('Contract', contractSchema);
export default Contract;