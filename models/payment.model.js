import mongoose from 'mongoose';

const paymentSchema = new mongoose.Schema({
    jobId: { type: mongoose.Schema.Types.ObjectId, ref: 'Job' },
    contractorId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    amount: Number,
    status: {
      type: String,
      enum: ['pending_approval', 'approved', 'completed'],
      default: 'pending_approval'
    },
    stripeTransferId: String
  });

const Payment = mongoose.model('Payment', paymentSchema);