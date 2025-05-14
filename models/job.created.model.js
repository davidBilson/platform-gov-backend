import mongoose from 'mongoose';

const locationSchema = new mongoose.Schema({
  country: {
    type: String,
    trim: true
  },
  address1: {
    type: String,
    trim: true
  },
  address2: {
    type: String,
    trim: true
  },
  city: {
    type: String,
    trim: true
  },
  state: {
    type: String,
    trim: true
  },
  zipCode: {
    type: String,
    trim: true
  }
});

const milestoneSchema = new mongoose.Schema({
  id: {
    type: Number,
    required: true
  },
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
    default: null
  }
});

const jobSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  // Added client information fields
  clientName: {
    type: String,
    trim: true
  },
  clientLogo: {
    type: String,
    trim: true
  },
  clientDepartment: {
    type: String,
    trim: true
  },
  clientClearance: {
    type: String,
    trim: true
  },
  clientIndustry: {
    type: String,
    trim: true
  },
  clientCompanySize: {
    type: String,
    trim: true
  },
  clientSpecializations: {
    type: [String],
    default: []
  },
  clientLocation: {
    type: [locationSchema],
    default: []
  },
  clientAccountAge: {
    type: Date
  },
  userRole: {
    type: String,
    required: true,
    enum: ['client', 'admin'],
    default: 'client'
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
    enum: ['Full Time', 'part-time'],
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
    default: null
  },
  // New fields for retainer payment type
  retainerAmount: {
    type: Number,
    min: 0,
    default: 0
  },
  retainerFrequency: {
    type: String,
    enum: ['Hour', 'Day', 'Week', 'Month'],
    default: 'Week'
  },
  retainerDuration: {
    type: Number,
    min: 1,
    default: 1
  },
  status: {
    type: String,
    // we are supposed to have [open, active, completed, closed]
    enum: ['open', 'active', 'closed', 'completed'],
    default: 'open'
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

jobSchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  next();
});

const Job = mongoose.model('Jobs', jobSchema);

export default Job;