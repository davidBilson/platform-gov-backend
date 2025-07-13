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
    required: true,
    unique: true
  },
  contractorSigned: {
    type: Boolean,
    default: false
  },
  clientSigned: {
    type: Boolean,
    default: true
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
      enum: ['hourly', 'fixed-price', 'retainer', 'commission'],
      required: true,
      default: ''
    },
    employmentType: {
      type: String,
      enum: ['Full-time', 'Part-time'],
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

hiringSchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  next();
});

hiringSchema.path('offerDetails.employmentType').validate(function(value) {
  return ['Full-time', 'Part-time'].includes(value);
}, 'Invalid employment type');

const Hiring = mongoose.model('Hiring', hiringSchema);
export default Hiring;