import mongoose from 'mongoose';

const userSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Please provide your name'],
    trim: true
  },
  email: {
    type: String,
    required: [true, 'Please provide your email'],
    unique: true,
    lowercase: true,
    trim: true
  },
  escrowAccount: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'EscrowAccount'
  },
  password: {
    type: String,
    required: [true, 'Please provide a password'],
    minlength: 8,
    select: false
  },
  phoneNumber: {
    type: String,
    trim: true
  },
  role: {
    type: String,
    enum: ['contractor', 'client', 'admin', 'superadmin'],
    default: 'contractor'
  },
  isSuspended: {
    type: Boolean,
    default: false
  },
  isHighPriority: {
    type: Boolean,
    default: false
  },
  isEmailVerified: {
    type: Boolean,
    default: false
  },
  isPhoneVerified: {
    type: Boolean,
    default: false
  },
  isSubscribed: { // if the user has an active subscription (premium or free) true or false
    type: Boolean,
    default: false
  },
  stripeCustomerId: {
    type: String,
    default: null
  },
  stripeAccountId: {
    type: String,
    default: null
  },
  defaultPaymentMethod: {
    type: String,
    default: null
  },
  bankAccounts: [{
    id: String,
    bankName: String,
    last4: String,
    country: String,
    currency: String,
    isDefault: Boolean
  }],
  emailVerificationCode: String,
  phoneVerificationCode: String,
  resetToken: String,
  resetTokenExpiry: Date,
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

userSchema.pre('save', function (next) {
  this.updatedAt = Date.now();
  next();
});

// Method to check subscription status from Subscription model
userSchema.methods.checkSubscriptionStatus = async function () {
  const Subscription = mongoose.model('Subscription');
  const activeSubscription = await Subscription.findOne({
    userId: this._id,
    status: { $in: ['active', 'pending'] },
    'subscriptionPeriod.endDate': { $gt: new Date() }
  });

  this.isSubscribed = !!activeSubscription;
  return this.save();
};

const User = mongoose.model('User', userSchema);
export default User;