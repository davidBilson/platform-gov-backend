import mongoose from 'mongoose';
const { Schema } = mongoose;

// Work history schema
const WorkHistorySchema = new Schema({
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
  }
});

// Profile schema
const profileSchema = new Schema({
  user: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'Profile must belong to a user']
  },
  firstName: {
    type: String,
    required: [true, 'Please provide your first name'],
    trim: true
  },
  lastName: {
    type: String,
    required: [true, 'Please provide your last name'],
    trim: true
  },
  bio: {
    type: String,
    trim: true
  },
  profileImage: {
    type: String,
    default: ''
  },
  ratePerHour: {
    type: Number,
    default: 0
  },
  primaryPosition: {
    type: String,
    trim: true
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
  timestamps: true
});

// Index for faster queries
profileSchema.index({ user: 1 }, { unique: true });
profileSchema.index({ skills: 1 });
profileSchema.index({ expertise: 1 });
profileSchema.index({ certifications: 1 });

// Virtual for full name
profileSchema.virtual('fullName').get(function() {
  return `${this.firstName} ${this.lastName}`;
});

// Document middleware: runs before .save() and .create()
profileSchema.pre('save', function(next) {
  // Convert rate per hour to number if it's a string
  if (typeof this.ratePerHour === 'string') {
    this.ratePerHour = parseFloat(this.ratePerHour) || 0;
  }
  this.updatedAt = Date.now();
  next();
});

const Profile = mongoose.model('Profile', profileSchema);
export default Profile;