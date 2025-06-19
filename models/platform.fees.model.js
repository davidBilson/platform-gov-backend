import mongoose from 'mongoose';

const platformFeesSchema = new mongoose.Schema({
  freelancerServiceFee: {
    type: Number,
    required: true,
    min: 0,
    max: 10
  },
  clientServiceFee: {
    type: Number,
    required: true,
    min: 0,
    max: 10
  },
  minimumWithdrawal: {
    type: Number,
    min: 0,
    default: 0
  },
  payoutDelay: {
    type: Number,
    min: 0,
    max: 10
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

platformFeesSchema.statics.getSettings = function() {
  return this.findOneAndUpdate(
    {}, 
    {}, 
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );
};

const PlatformFees = mongoose.model('PlatformFees', platformFeesSchema);
export default PlatformFees;