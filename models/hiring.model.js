import mongoose from 'mongoose';

const hiringSchema = new mongoose.Schema({
  jobId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Jobs',
    required: true
  },
  clientId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  contractorId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  applicationId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'JobApplications',
    required: true
  },
  status: {
    type: String,
    enum: ['offered', 'accepted', 'declined', 'withdrawn'],
    required: true,
    default: 'offered'
  },
  offerDetails: {
    rate: {
      type: Number,
      required: true
    },
    paymentType: {
      type: String,
      enum: ['hourly', 'fixed-price', 'retainer'],
      required: true,
      default: 'hourly'
    },
    employmentType: {
      type: String,
      enum: ['one-time', 'full-time', 'part-time'],  // Updated to match frontend options
      required: true
    },
    startDate: {
      type: Date,
      required: true
    },
    estimatedEndDate: {
      type: Date
    },
    milestones: [{
      description: String,
      price: Number,
      dueDate: Date
    }]
  },
  documents: [{
    originalName: String,
    url: String,
    publicId: String,
    format: String,
    resourceType: String,
    size: Number,
    uploadedAt: {
      type: Date,
      default: Date.now
    }
  }],
  clientNotes: {
    type: String,
    trim: true,
    default: ''
  },
  contractorNotes: {
    type: String,
    trim: true,
    default: ''
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

// Indexes
hiringSchema.index({ jobId: 1 });
hiringSchema.index({ clientId: 1 });
hiringSchema.index({ contractorId: 1 });
hiringSchema.index({ status: 1 });

// Document middleware
hiringSchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  next();
});

// Validation for employment type
hiringSchema.path('offerDetails.employmentType').validate(function(value) {
  return ['one-time', 'full-time', 'part-time'].includes(value);
}, 'Invalid employment type');

const Hiring = mongoose.model('Hiring', hiringSchema);
export default Hiring;