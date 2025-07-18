import mongoose from 'mongoose';

const jobApplicationSchema = new mongoose.Schema({
  // Core relationships
  jobId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Jobs',
    required: true
  },
  freelancerId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  freelancerProfileId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'ContractorProfile',
    required: true
  },
  
  // Application content
  coverLetter: {
    type: String,
    required: function() { return this.status !== 'draft'; },
  },
  proposedRate: {
    type: Number,
    required: function() { return this.status !== 'draft'; },
    min: 0
  },
  
  // For milestone-based jobs, freelancer can propose alternative milestones
  proposedMilestones: [{
    description: {
      type: String,
    },
    price: {
      type: Number,
      min: 0
    },
    dueDate: {
      type: Date
    }
  }],
  
  // For retainer jobs, freelancer can propose different terms
  proposedRetainerAmount: {
    type: Number,
    min: 0
  },
  proposedRetainerFrequency: {
    type: String,
    enum: ['Hour', 'Day', 'Week', 'Month']
  },
  proposedRetainerDuration: {
    type: Number,
    min: 1
  },
  
  // Availability info
  availableStartDate: {
    type: Date
  },
  availability: {
    type: String,
    enum: ['immediate', 'one_week', 'two_weeks', 'one_month', 'custom'],
    default: 'immediate'
  },
  customAvailabilityNote: {
    type: String,
    trim: true
  },
  
  // Relevant experience and credentials for this specific job
  relevantSkills: {
    type: [String],
    default: []
  },
  relevantExperience: {
    type: String,
    trim: true
  },
  
  // File attachments
  attachments: {
    type: [{
      filename: String,
      originalName: String,
      fileSize: Number,
      fileType: String,
      fileUrl: String,
      uploadedAt: {
        type: Date,
        default: Date.now
      }
    }],
    default: []
  },
  
  // Security clearance and certifications acknowledgment
  certificationAcknowledgment: {
    type: Boolean,
    default: false,
    required: function() { return this.status !== 'draft'; }
  },
  
  // Application status tracking
  status: {
    type: String,
    enum: ['draft', 'pending', 'viewed', 'active'],
    default: 'draft'
  },
  clientNotes: {
    type: String,
    trim: true
  },
  
  // Interview/meeting tracking
  interviews: [{
    scheduledDate: Date,
    meetingLink: String,
    notes: String,
    completed: {
      type: Boolean,
      default: false
    }
  }],
  
  // Communication history references
  messageThreadId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'MessageThread'
  },
  
  // Timestamps
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  },
  viewedAt: {
    type: Date
  },
  lastStatusChangeAt: {
    type: Date,
    default: Date.now
  },
  
  // Auto-delete drafts after X days
  draftExpiresAt: {
    type: Date
  }
});

// Indexes for faster queries
jobApplicationSchema.index({ jobId: 1, freelancerId: 1 }, { unique: true }); // One application per job per freelancer
jobApplicationSchema.index({ jobId: 1, status: 1 }); // For filtering applications by job and status
jobApplicationSchema.index({ freelancerId: 1, status: 1 }); // For freelancers to check their application statuses
jobApplicationSchema.index({ createdAt: -1 }); // For sorting by most recent
jobApplicationSchema.index({ status: 1, draftExpiresAt: 1 }); // For cleanup of expired drafts

// Document middleware: runs before save
jobApplicationSchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  
  // If status changed, update lastStatusChangeAt
  if (this.isModified('status')) {
    this.lastStatusChangeAt = Date.now();
    
    // If status changed to 'viewed' for the first time
    if (this.status === 'viewed' && !this.viewedAt) {
      this.viewedAt = Date.now();
    }
    
    // If saving as draft, set expiration (30 days)
    if (this.status === 'draft') {
      const thirtyDaysFromNow = new Date();
      thirtyDaysFromNow.setDate(thirtyDaysFromNow.getDate() + 30);
      this.draftExpiresAt = thirtyDaysFromNow;
    } else {
      // Clear draft expiration for submitted applications
      this.draftExpiresAt = null;
    }
  }
  
  next();
});

jobApplicationSchema.pre('save', function(next) {
  if (this.status !== 'draft') {
    if (!this.coverLetter) {
      return next(new Error('Cover letter is required'));
    }
    if (!this.proposedRate) {
      return next(new Error('Proposed rate is required'));
    }
    if (!this.certificationAcknowledgment) {
      return next(new Error('You must acknowledge that you have the required certifications'));
    }
  }
  next();
});

const JobApplication = mongoose.model('JobApplications', jobApplicationSchema);

export default JobApplication;