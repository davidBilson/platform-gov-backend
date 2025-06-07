import mongoose from 'mongoose';

const platformFeesSchema = new mongoose.Schema({
  freelancerServiceFee: {
    type: Number,
    required: true,
    min: 0,
    max: 50 // 50% max fee
  },
  clientServiceFee: {
    type: Number,
    required: true,
    min: 0,
    max: 50 // 50% max fee
  },
  minimumWithdrawal: {
    type: Number,
    min: 0,
    default: 0
  },
  payoutDelay: {
    type: Number,
    min: 0,
    max: 30 // 30 days max delay
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

// Create a single document for global settings
platformFeesSchema.statics.getSettings = function() {
  return this.findOneAndUpdate(
    {}, 
    {}, 
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );
};

const PlatformFees = mongoose.model('PlatformFees', platformFeesSchema);
export default PlatformFees;