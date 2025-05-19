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