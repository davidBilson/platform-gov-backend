// Updated profile.model.js
import mongoose from 'mongoose';
const { Schema } = mongoose;

// Work history schema
const WorkHistorySchema = new Schema({
  id: {
    type: String,
    required: true
  },
  title: {
    type: String,
    trim: true
  },
  department: {
    type: String,
    trim: true
  },
  departmentType: {
    type: String,
    enum: ['state', 'federal', ''],
    default: ''
  },
  experienceLevel: {
    type: String,
    trim: true
  },
  location: {
    type: String,
    trim: true
  },
  fromDate: {
    type: String,
    trim: true
  },
  toDate: {
    type: String,
    trim: true
  }
});

// Degree schema
const DegreeSchema = new Schema({
  id: {
    type: String,
    required: true
  },
  degree: {
    type: String,
    trim: true
  },
  institution: {
    type: String,
    trim: true
  },
  yearCompleted: {
    type: String,
    trim: true
  },
  gpa: {
    type: String,
    trim: true
  },
});

// Profile schema
const contractorProfileSchema = new Schema({
 
  user: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'Profile must belong to a user']
  },
  bio: {
    type: String,
    trim: true
  },
  profileImage: {
    type: String,
    default: ''
  },
  clearance: {  // Add this field
    type: String,
    trim: true,
    default: ''
  },
  ratePerHour: {
    type: Number,
    default: 0
  },
  secondRate: {
    type: Number,
    default: 0
  },
  primaryPosition: {
    type: String,
    trim: true
  },
  profession: {
    type: String,
    trim: true
  },
  firmAffiliation: {
    type: String,
    trim: true,
    default: ""
  },
  location: {
    country: {
      type: String,
      trim: true,
      default: ""
    },
    state: {
      type: String,
      trim: true,
      default: ""
    }
  },
  skills: [String],
  expertise: [String],
  certifications: [String],
  workHistory: [WorkHistorySchema],
  degrees: [DegreeSchema],
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true,
});


// Index for faster queries
contractorProfileSchema.index({ user: 1 }, { unique: true });
contractorProfileSchema.index({ skills: 1 });
contractorProfileSchema.index({ expertise: 1 });
contractorProfileSchema.index({ certifications: 1 });


// Document middleware: runs before .save() and .create()
contractorProfileSchema.pre('save', function(next) {
  // Convert rate per hour to number if it's a string
  if (typeof this.ratePerHour === 'string') {
    this.ratePerHour = parseFloat(this.ratePerHour) || 0;
  }
  this.updatedAt = Date.now();
  next();
});

const ContractorProfile = mongoose.model('ContractorProfile', contractorProfileSchema);
export default ContractorProfile;