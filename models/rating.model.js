import mongoose from 'mongoose';

const ratingSchema = new mongoose.Schema({
  contractId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Contract',
    required: true
  },
  jobId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Jobs',
    required: true
  },
  reviewer: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  reviewee: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  role: {
    type: String,
    enum: ['client', 'contractor'],
    required: true
  },
  rating: {
    type: Number,
    required: true,
    min: 1,
    max: 5
  },
  comments: {
    type: String,
    trim: true
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
ratingSchema.index({ contractId: 1 });
ratingSchema.index({ jobId: 1 });
ratingSchema.index({ reviewer: 1 });
ratingSchema.index({ reviewee: 1 });
ratingSchema.index({ role: 1 });
ratingSchema.index({ rating: 1 });

// Document middleware
ratingSchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  next();
});

// Prevent duplicate ratings for the same contract by the same reviewer
ratingSchema.index({ contractId: 1, reviewer: 1 }, { unique: true });

const Rating = mongoose.model('Rating', ratingSchema);
export default Rating;