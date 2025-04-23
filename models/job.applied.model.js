import mongoose from 'mongoose';

const jobApplicationSchema = new mongoose.Schema({
  // Core relationships
  jobId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Job',
    required: true
  },
  applicantId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  
  // Application details
  coverLetter: {
    type: String,
    trim: true
  },
  proposedRate: {
    type: Number,
    min: 0
  },
  
  // For fixed-price jobs, applicants can propose their own milestone structure
  proposedMilestones: [{
    description: {
      type: String,
      trim: true
    },
    price: {
      type: Number,
      min: 0
    },
    estimatedCompletionDate: {
      type: Date
    }
  }],
  
  // Applicant's availability
  availableStartDate: {
    type: Date
  },
  
  // Additional qualification data
  relevantSkills: {
    type: [String],
    default: []
  },
  relevantCertifications: {
    type: [String],
    default: []
  },
  attachments: {
    type: [String], // URLs to resume, portfolio, or other documents
    default: []
  },
  
  // Application status
  status: {
    type: String,
    enum: ['pending', 'reviewed', 'shortlisted', 'interviewed', 'accepted', 'rejected', 'withdrawn'],
    default: 'pending'
  },
  
  // Timestamps
  submittedAt: {
    type: Date,
    default: Date.now
  },
  lastUpdated: {
    type: Date,
    default: Date.now
  },
  
  // Communication history
  messages: [{
    sender: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    content: {
      type: String,
      trim: true
    },
    timestamp: {
      type: Date,
      default: Date.now
    },
    read: {
      type: Boolean,
      default: false
    }
  }],
  
  // Interview scheduling (if applicable)
  interviewSchedule: {
    proposedTimes: [{
      startTime: Date,
      endTime: Date
    }],
    confirmedTime: {
      startTime: Date,
      endTime: Date
    },
    location: {
      type: String,
      trim: true
    },
    virtual: {
      type: Boolean,
      default: true
    },
    meetingLink: {
      type: String,
      trim: true
    }
  },
  
  // Employer notes (private)
  employerNotes: {
    type: String,
    trim: true
  },
  
  // Any custom fields for specific job types
  additionalInformation: {
    type: mongoose.Schema.Types.Mixed
  }
});

// Pre-save middleware to update the lastUpdated field
jobApplicationSchema.pre('save', function(next) {
  this.lastUpdated = Date.now();
  next();
});

// Indexes for performance
jobApplicationSchema.index({ jobId: 1, applicantId: 1 }, { unique: true });
jobApplicationSchema.index({ status: 1 });
jobApplicationSchema.index({ submittedAt: -1 });

const JobApplication = mongoose.model('JobApplication', jobApplicationSchema);

export default JobApplication;