// transaction history

import mongoose from 'mongoose';

const TransactionSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  jobId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Jobs',
  },
  type: {
    type: String,
    enum: [
      'payment_method_added',
      'project_funding',
      'payout_pending', //Funds in 5-day hold
      'payout', // Funds withdrawn
      'refund',
      'dispute'
    ],
    required: true
  },
  amount: {
    type: Number,
    required: true
  },
  fee: {
    type: Number,
    default: 0
  },
  netAmount: {
    type: Number,
    default: 0
  },
  currency: {
    type: String,
    default: 'usd'
  },
  status: {
    type: String,
    enum: [
      'pending',
      'completed',
      'failed',
      'refunded',
      'disputed'
    ],
    default: 'pending'
  },
  paymentMethod: {
    type: String,
    enum: ['card', 'bank_account', 'paypal', 'escrow'],
    required: true
  },
  stripePaymentIntentId: String,
  stripeChargeId: String,
  stripeCustomerId: String,
  stripePayoutId: String,
  description: String,
  metadata: mongoose.Schema.Types.Mixed,
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

TransactionSchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  next();
});

const Transaction = mongoose.model('Transactions', TransactionSchema);

export default Transaction;