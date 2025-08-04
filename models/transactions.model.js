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
  subscriptionId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Subscriptions', // your subscription model
  },
  type: {
    type: String,
    enum: [
      'payment_method_added',
      'project_funding',
      'payout_pending',
      'payout_available',
      'payout',
      'withdrawal',
      'refund',
      'dispute',
      'instant_payment_client',
      'instant_payment_contractor',
      'subscription_payment', 
      'subscription_cancelled', 
      'subscription_resumed' 
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
    enum: ['card', 'bank_account', 'paypal', 'escrow', 'stripe'],
    required: true
  },
  stripePaymentIntentId: String,
  stripeChargeId: String,
  stripeCustomerId: String,
  stripePayoutId: String,
  stripeSubscriptionId: String, // ✅ new field
  description: String,
  metadata: mongoose.Schema.Types.Mixed,
}, {
  timestamps: true
});

const Transaction = mongoose.model('Transactions', TransactionSchema);

export default Transaction;
