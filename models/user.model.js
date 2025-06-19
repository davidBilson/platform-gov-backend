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
    enum: ['contractor', 'client', 'admin'],
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
  
  stripeCustomerId: String,
  stripeAccountId: String,
  defaultPaymentMethod: String,
  bankAccounts: [{
    id: String,
    last4: String,
    bankName: String,
    country: String,
    currency: String,
    default: Boolean
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
 
userSchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  next();
});

const User = mongoose.model('User', userSchema);
export default User;