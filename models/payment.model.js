import mongoose from 'mongoose';

const paymentSchema = new mongoose.Schema({
  jobId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Job',
    required: true
  },
  clientId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  methodId: {
    type: String,
    required: true
  },
  amount: {
    type: Number,
    required: true
  },
  status: {
    type: String,
    enum: ['pending', 'succeeded', 'failed'],
    default: 'pending'
  },
  fundedAt: {
    type: Date
  }
}, { timestamps: true });

export default mongoose.model('Payment', paymentSchema);