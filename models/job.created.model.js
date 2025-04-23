import mongoose from 'mongoose';

const milestoneSchema = new mongoose.Schema({
  description: {
    type: String,
    required: true,
    trim: true
  },
  price: {
    type: Number,
    required: true,
    min: 0
  },
  dueDate: {
    type: Date,
    required: true
  }
});

const jobSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  userRole: {
    type: String,
    required: true,
    enum: ['business', 'individual', 'admin'],
    default: 'business'
  },
  location: {
    type: String,
    required: true,
    trim: true
  },
  jobCategory: {
    type: String,
    required: true,
    trim: true
  },
  jobTitle: {
    type: String,
    required: true,
    trim: true
  },
  description: {
    type: String,
    required: true,
    trim: true
  },
  requiredSkills: {
    type: [String],
    default: []
  },
  requiredCertifications: {
    type: [String],
    default: []
  },
  requiresRegisteredLobbyist: {
    type: Boolean,
    default: false
  },
  employmentType: {
    type: String,
    enum: ['full-time', 'part-time'],
    required: true
  },
  paymentType: {
    type: String,
    enum: ['hourly', 'fixed-price', 'retainer'],
    required: true
  },
  price: {
    type: Number,
    required: true,
    min: 0
  },
  milestones: {
    type: [milestoneSchema],
    default: []
  },
  startDate: {
    type: Date,
    required: true
  },
  status: {
    type: String,
    enum: ['draft', 'active', 'closed', 'completed'],
    default: 'active'
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
});

// Pre-save middleware to update the updatedAt field
jobSchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  next();
});

const Job = mongoose.model('Job', jobSchema);

export default Job;