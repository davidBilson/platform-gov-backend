import mongoose from 'mongoose';
const { Schema } = mongoose;

// Enums for better type safety and validation
const FUND_STATUS = {
  AVAILABLE: 'available',
  IN_PROGRESS: 'in_progress',
  PENDING_REVIEW: 'pending_review',
  PENDING_RELEASE: 'pending_release',
  IN_REVIEW: 'in_review',
  RELEASED: 'released',
  WITHDRAWN: 'withdrawn',
  IN_DISPUTE: 'in_dispute'
};

const TRANSACTION_TYPE = {
  FUND: 'fund',
  RELEASE: 'release',
  REFUND: 'refund',
  DISPUTE_HOLD: 'dispute_hold',
  DISPUTE_RESOLVE: 'dispute_resolve',
  PLATFORM_FEE: 'platform_fee'
};

const TRANSACTION_STATUS = {
  PENDING: 'pending',
  COMPLETED: 'completed',
  FAILED: 'failed'
};

const DISPUTE_STATUS = {
  OPEN: 'open',
  RESOLVED: 'resolved',
  REJECTED: 'rejected'
};

const CURRENCY_CODES = ['USD', 'EUR', 'GBP', 'CAD', 'AUD', 'JPY', 'NGN'];

// ========================================
// 1. FUNDS SCHEMA
// ========================================
const fundSchema = new Schema({
  job_id: {
    type: Schema.Types.ObjectId,
    required: true,
    index: true,
    ref: 'Jobs'
  },
  client_id: {
    type: Schema.Types.ObjectId,
    required: true,
    index: true,
    ref: 'User' // Assuming clients are User documents
  },
  contractor_id: {
    type: Schema.Types.ObjectId,
    index: true,
    ref: 'User' // Assuming freelancers are User documents
  },
  is_processed: {
    type: Boolean,
    default: false,
    index: true
  },
  available_after: Date,
  
  processing_attempts: {
    type: Number,
    default: 0,
    max: 3
  },
  
  stripe_transfer_id: {
    type: String,
    sparse: true,
    unique: true
  },
  amount: {
    type: Number,
    required: true,
    min: [0.01, 'Amount must be greater than 0'],
    validate: {
      validator: function(v) {
        return Number.isFinite(v) && v > 0;
      },
      message: 'Amount must be a valid positive number'
    }
  },
  currency: {
    type: String,
    required: true,
    enum: CURRENCY_CODES,
    default: 'USD',
    uppercase: true
  },
  status: {
    type: String,
    required: true,
    enum: Object.values(FUND_STATUS),
    default: FUND_STATUS.AVAILABLE,
    index: true
  },
  due_date: {
    type: Date,
    validate: {
      validator: function(v) {
        return !v || v > new Date();
      },
      message: 'Due date must be in the future'
    }
  },
  admin_notes: {
    type: String,
    maxlength: [1000, 'Admin notes cannot exceed 1000 characters']
  },
  // Additional useful fields
  milestone_title: {
    type: String,
    maxlength: [200, 'Milestone title cannot exceed 200 characters']
  },
  milestone_description: {
    type: String,
    maxlength: [1000, 'Milestone description cannot exceed 1000 characters']
  },
  work_submitted_at: Date,
  review_requested_at: Date,
  released_at: Date,
  disputed_at: Date,
  // Delay functionality
  delay_until: Date,
  delay_reason: {
    type: String,
    maxlength: [500, 'Delay reason cannot exceed 500 characters']
  },
  delayed_by: {
    type: Schema.Types.ObjectId,
    ref: 'User'
  },
  delay_set_at: Date
}, {
  timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' },
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Compound indexes for efficient queries
fundSchema.index({ client_id: 1, status: 1 });
fundSchema.index({ status: 1, createdAt: -1 });
fundSchema.index({ contractor_id: 1, status: 1 });
fundSchema.index({ job_id: 1, status: 1 });
fundSchema.index({ created_at: -1 });

// Virtual for checking if fund is overdue
fundSchema.virtual('is_overdue').get(function() {
  return this.due_date && this.due_date < new Date() && 
         ![FUND_STATUS.RELEASED, FUND_STATUS.IN_DISPUTE].includes(this.status);
});

// Virtual for checking if delay period is active
fundSchema.virtual('is_delayed').get(function() {
  return this.delay_until && this.delay_until > new Date();
});

// Virtual for checking if delay has expired
fundSchema.virtual('delay_expired').get(function() {
  return this.delay_until && this.delay_until <= new Date();
});

// Instance methods
fundSchema.methods.canRelease = function() {
  // Cannot release if delayed and delay hasn't expired
  if (this.is_delayed) return false;
  return [FUND_STATUS.PENDING_REVIEW, FUND_STATUS.IN_REVIEW].includes(this.status);
};

fundSchema.methods.canDispute = function() {
  return ![FUND_STATUS.RELEASED, FUND_STATUS.IN_DISPUTE].includes(this.status);
};

fundSchema.methods.setDelay = function(adminId, days, reason) {
  this.delay_until = new Date(Date.now() + days * 24 * 60 * 60 * 1000);
  this.delay_reason = reason;
  this.delayed_by = adminId;
  this.delay_set_at = new Date();
};

fundSchema.methods.clearDelay = function() {
  this.delay_until = undefined;
  this.delay_reason = undefined;
  this.delayed_by = undefined;
  this.delay_set_at = undefined;
};

// ========================================
// 2. ESCROW ACCOUNTS SCHEMA
// ========================================
const escrowAccountSchema = new Schema({
  client_id: {
    type: Schema.Types.ObjectId,
    required: true,
    unique: true,
    index: true,
    ref: 'User'
  },
  balance: {
    type: Number,
    required: true,
    min: [0, 'Balance cannot be negative'],
    default: 0,
    validate: {
      validator: function(v) {
        return Number.isFinite(v) && v >= 0;
      },
      message: 'Balance must be a valid non-negative number'
    }
  },
  currency: {
    type: String,
    required: true,
    enum: CURRENCY_CODES,
    default: 'USD',
    uppercase: true
  },
  last_funded_at: {
    type: Date,
    default: Date.now
  },
  // Additional security and tracking fields
  frozen: {
    type: Boolean,
    default: false
  },
  freeze_reason: String,
  total_funded: {
    type: Number,
    default: 0,
    min: 0
  },
  total_released: {
    type: Number,
    default: 0,
    min: 0
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Virtual for available balance (excluding frozen funds)
escrowAccountSchema.virtual('available_balance').get(function() {
  return this.frozen ? 0 : this.balance;
});

// Instance methods
escrowAccountSchema.methods.hasSufficientBalance = function(amount) {
  return this.available_balance >= amount;
};

escrowAccountSchema.methods.addFunds = function(amount) {
  this.balance += amount;
  this.total_funded += amount;
  this.last_funded_at = new Date();
};

escrowAccountSchema.methods.deductFunds = function(amount) {
  if (!this.hasSufficientBalance(amount)) {
    throw new Error('Insufficient balance');
  }
  this.balance -= amount;
  this.total_released += amount;
};

// ========================================
// 3. TRANSACTIONS SCHEMA
// ========================================
const transactionSchema = new Schema({
  fund_id: {
    type: Schema.Types.ObjectId,
    required: true,
    index: true,
    ref: 'Fund'
  },
  userId: {
    type: Schema.Types.ObjectId,
    ref: 'User'
  },
  amount: {
    type: Number,
    required: true,
    validate: {
      validator: function(v) {
        return Number.isFinite(v) && v !== 0;
      },
      message: 'Amount must be a valid non-zero number'
    }
  },
  currency: {
    type: String,
    required: true,
    enum: CURRENCY_CODES,
    uppercase: true
  },
  status: {
    type: String,
    required: true,
    enum: Object.values(TRANSACTION_STATUS),
    default: TRANSACTION_STATUS.PENDING,
    index: true
  },
  notes: {
    type: String,
    maxlength: [500, 'Notes cannot exceed 500 characters']
  },
  // Additional tracking fields
  processed_at: Date,
  failed_reason: String,
  external_transaction_id: String, // For payment processor integration
  fee_amount: {
    type: Number,
    default: 0,
    min: 0
  }
}, {
  timestamps: { createdAt: 'timestamp', updatedAt: 'updated_at' },
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Compound indexes for efficient queries
transactionSchema.index({ fund_id: 1, timestamp: -1 });
transactionSchema.index({ timestamp: -1 });

// Virtual for net amount (amount minus fees)
transactionSchema.virtual('net_amount').get(function() {
  return this.amount - this.fee_amount;
});

// Instance methods
transactionSchema.methods.markCompleted = function() {
  this.status = TRANSACTION_STATUS.COMPLETED;
  this.processed_at = new Date();
};

transactionSchema.methods.markFailed = function(reason) {
  this.status = TRANSACTION_STATUS.FAILED;
  this.failed_reason = reason;
  this.processed_at = new Date();
};

// ========================================
// 4. DISPUTES SCHEMA
// ========================================
const disputeSchema = new Schema({
  fund_id: {
    type: Schema.Types.ObjectId,
    required: true,
    index: true,
    ref: 'Fund'
  },
  initiator_id: {
    type: Schema.Types.ObjectId,
    required: true,
    index: true,
    ref: 'User'
  },
  respondent_id: {
    type: Schema.Types.ObjectId,
    required: true,
    ref: 'User'
  },
  status: {
    type: String,
    required: true,
    enum: Object.values(DISPUTE_STATUS),
    default: DISPUTE_STATUS.OPEN,
    index: true
  },
  reason: {
    type: String,
    required: true,
    enum: [
      'work_not_delivered',
      'work_quality_issues',
      'scope_disagreement',
      'payment_dispute',
      'communication_issues',
      'other'
    ]
  },
  description: {
    type: String,
    required: true,
    maxlength: [2000, 'Description cannot exceed 2000 characters']
  },
  resolution_notes: {
    type: String,
    maxlength: [2000, 'Resolution notes cannot exceed 2000 characters']
  },
  resolved_at: Date,
  assigned_admin: {
    type: Schema.Types.ObjectId,
    ref: 'User'
  },
  // Evidence and communication
  evidence_files: [{
    filename: String,
    url: String,
    uploaded_by: {
      type: Schema.Types.ObjectId,
      ref: 'User'
    },
    uploaded_at: {
      type: Date,
      default: Date.now
    }
  }],
  messages: [{
    sender_id: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    message: {
      type: String,
      required: true,
      maxlength: 1000
    },
    sent_at: {
      type: Date,
      default: Date.now
    },
    is_admin_message: {
      type: Boolean,
      default: false
    }
  }],
  // Resolution details
  resolution_type: {
    type: String,
    enum: ['full_refund', 'partial_refund', 'release_to_freelancer', 'split_amount', 'other']
  },
  resolution_amount_client: {
    type: Number,
    min: 0
  },
  resolution_amount_freelancer: {
    type: Number,
    min: 0
  }
}, {
  timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' },
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Compound indexes
disputeSchema.index({ status: 1, created_at: -1 });
disputeSchema.index({ initiator_id: 1, status: 1 });
disputeSchema.index({ assigned_admin: 1, status: 1 });

// Virtual for dispute age
disputeSchema.virtual('age_in_days').get(function() {
  return Math.floor((new Date() - this.created_at) / (1000 * 60 * 60 * 24));
});

// Instance methods
disputeSchema.methods.resolve = function(resolutionType, clientAmount, freelancerAmount, notes) {
  this.status = DISPUTE_STATUS.RESOLVED;
  this.resolution_type = resolutionType;
  this.resolution_amount_client = clientAmount;
  this.resolution_amount_freelancer = freelancerAmount;
  this.resolution_notes = notes;
  this.resolved_at = new Date();
};

disputeSchema.methods.addMessage = function(senderId, message, isAdmin = false) {
  this.messages.push({
    sender_id: senderId,
    message: message,
    is_admin_message: isAdmin
  });
};

// ========================================
// PRE-SAVE MIDDLEWARE
// ========================================

// Fund pre-save middleware
fundSchema.pre('save', function(next) {
  // Set timestamps for status changes
  if (this.isModified('status')) {
    const now = new Date();
    switch (this.status) {
      case FUND_STATUS.PENDING_REVIEW:
        this.work_submitted_at = now;
        break;
      case FUND_STATUS.IN_REVIEW:
        this.review_requested_at = now;
        break;
      case FUND_STATUS.RELEASED:
        this.released_at = now;
        break;
      case FUND_STATUS.IN_DISPUTE:
        this.disputed_at = now;
        break;
    }
  }
  next();
});

// Transaction pre-save middleware


transactionSchema.pre('save', function(next) {
  if (this.isModified('status') && this.status === TRANSACTION_STATUS.COMPLETED) {
    this.processed_at = new Date();
  }
  next();
});

// ========================================
// MODEL CREATION
// ========================================
const Fund = mongoose.model('Fund', fundSchema);
const EscrowAccount = mongoose.model('EscrowAccount', escrowAccountSchema);
const Transaction = mongoose.model('Transaction', transactionSchema);
const Dispute = mongoose.model('Dispute', disputeSchema);

// Export models and enums
export  {
  Fund,
  EscrowAccount,
  Transaction,
  Dispute,
  AdminAction,
  AdminPermission,
  FUND_STATUS,
  TRANSACTION_TYPE,
  TRANSACTION_STATUS,
  DISPUTE_STATUS,
  CURRENCY_CODES
};

const adminActionSchema = new Schema({
  admin_id: {
    type: Schema.Types.ObjectId,
    required: true,
    index: true,
    ref: 'User'
  },
  action_type: {
    type: String,
    required: true,
    enum: [
      'fund_status_change',
      'dispute_assignment',
      'dispute_resolution',
      'account_freeze',
      'account_unfreeze',
      'manual_transaction',
      'fund_override',
      'policy_enforcement',
      'system_adjustment',
      'withdrawal_delay',
      'delay_cancel'
    ],
    index: true
  },
  target_type: {
    type: String,
    required: true,
    enum: ['fund', 'escrow_account', 'transaction', 'dispute', 'user']
  },
  target_id: {
    type: Schema.Types.ObjectId,
    required: true,
    index: true
  },
  previous_state: Schema.Types.Mixed, // Store the before state
  new_state: Schema.Types.Mixed, // Store the after state
  reason: {
    type: String,
    required: true,
    maxlength: [1000, 'Reason cannot exceed 1000 characters']
  },
  notes: {
    type: String,
    maxlength: [2000, 'Notes cannot exceed 2000 characters']
  },
  ip_address: String,
  user_agent: String,
  requires_approval: {
    type: Boolean,
    default: false
  },
  approved_by: {
    type: Schema.Types.ObjectId,
    ref: 'User'
  },
  approved_at: Date
}, {
  timestamps: { createdAt: 'performed_at', updatedAt: 'updated_at' },
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Indexes for admin actions
adminActionSchema.index({ admin_id: 1, performed_at: -1 });
adminActionSchema.index({ target_type: 1, target_id: 1 });
adminActionSchema.index({ action_type: 1, performed_at: -1 });

// ========================================
// 6. ADMIN PERMISSIONS SCHEMA
// ========================================
const adminPermissionSchema = new Schema({
  admin_id: {
    type: Schema.Types.ObjectId,
    required: true,
    unique: true,
    ref: 'User'
  },
  role: {
    type: String,
    required: true,
    enum: ['super_admin', 'senior_admin', 'dispute_specialist', 'finance_admin', 'support_admin'],
    default: 'support_admin'
  },
  permissions: {
    // Fund management permissions
    can_modify_funds: { type: Boolean, default: false },
    can_release_funds: { type: Boolean, default: false },
    can_freeze_funds: { type: Boolean, default: false },
    max_fund_amount: { type: Number, default: 0 }, // Maximum amount they can handle
    
    // Escrow permissions
    can_freeze_accounts: { type: Boolean, default: false },
    can_adjust_balances: { type: Boolean, default: false },
    can_view_all_accounts: { type: Boolean, default: false },
    
    // Dispute permissions
    can_assign_disputes: { type: Boolean, default: true },
    can_resolve_disputes: { type: Boolean, default: false },
    can_escalate_disputes: { type: Boolean, default: true },
    max_dispute_amount: { type: Number, default: 1000 },
    
    // Transaction permissions
    can_reverse_transactions: { type: Boolean, default: false },
    can_create_manual_transactions: { type: Boolean, default: false },
    can_view_all_transactions: { type: Boolean, default: false },
    
    // System permissions
    can_modify_admin_notes: { type: Boolean, default: true },
    can_access_audit_logs: { type: Boolean, default: false },
    can_export_reports: { type: Boolean, default: false }
  },
  restrictions: {
    ip_whitelist: [String],
    time_restrictions: {
      allowed_hours: {
        start: { type: Number, min: 0, max: 23 },
        end: { type: Number, min: 0, max: 23 }
      },
      allowed_days: [{ type: Number, min: 0, max: 6 }] // 0 = Sunday, 6 = Saturday
    },
    requires_two_factor: { type: Boolean, default: true },
    session_timeout: { type: Number, default: 30 } // minutes
  },
  created_by: {
    type: Schema.Types.ObjectId,
    ref: 'User'
  },
  is_active: { type: Boolean, default: true },
  last_login: Date,
  failed_login_attempts: { type: Number, default: 0 },
  locked_until: Date
}, {
  timestamps: true
});

// Admin permission methods
adminPermissionSchema.methods.canPerformAction = function(action, amount = 0) {
  if (!this.is_active) return false;
  
  const perms = this.permissions;
  switch (action) {
    case 'modify_fund':
      return perms.can_modify_funds && amount <= perms.max_fund_amount;
    case 'release_fund':
      return perms.can_release_funds;
    case 'resolve_dispute':
      return perms.can_resolve_disputes && amount <= perms.max_dispute_amount;
    case 'freeze_account':
      return perms.can_freeze_accounts;
    default:
      return false;
  }
};

adminPermissionSchema.methods.isWithinTimeRestrictions = function() {
  if (!this.restrictions.time_restrictions.allowed_hours) return true;
  
  const now = new Date();
  const currentHour = now.getHours();
  const currentDay = now.getDay();
  
  const { start, end } = this.restrictions.time_restrictions.allowed_hours;
  const hourAllowed = start <= currentHour && currentHour <= end;
  const dayAllowed = this.restrictions.time_restrictions.allowed_days.includes(currentDay);
  
  return hourAllowed && dayAllowed;
};

// ========================================
// ENHANCED ADMIN METHODS FOR EXISTING SCHEMAS
// ========================================

// Add admin methods to Fund schema
fundSchema.methods.adminUpdateStatus = function(adminId, newStatus, reason, notes) {
  const previousStatus = this.status;
  this.status = newStatus;
  this.admin_notes = notes || this.admin_notes;
  
  // Log the admin action
  return new AdminAction({
    admin_id: adminId,
    action_type: 'fund_status_change',
    target_type: 'fund',
    target_id: this._id,
    previous_state: { status: previousStatus },
    new_state: { status: newStatus },
    reason: reason,
    notes: notes
  });
};

fundSchema.methods.adminRelease = async function(adminId, reason) {
  if (!this.canRelease()) {
    throw new Error('Fund cannot be released in current status or is delayed');
  }
  
  const actionLog = this.adminUpdateStatus(adminId, FUND_STATUS.RELEASED, reason);
  await actionLog.save();
  
  // Create release transaction
  const transaction = new Transaction({
    fund_id: this._id,
    amount: this.amount,
    currency: this.currency,
    status: TRANSACTION_STATUS.COMPLETED,
    notes: `Admin release: ${reason}`
  });
  
  await transaction.save();
  await this.save();
  
  return { fund: this, transaction, adminAction: actionLog };
};

fundSchema.methods.adminDelayWithdrawal = function(adminId, days, reason) {
  if (this.status !== FUND_STATUS.IN_REVIEW) {
    throw new Error('Can only delay funds that are in review');
  }
  
  this.setDelay(adminId, days, reason);
  
  return new AdminAction({
    admin_id: adminId,
    action_type: 'withdrawal_delay',
    target_type: 'fund',
    target_id: this._id,
    previous_state: { delay_until: null },
    new_state: { delay_until: this.delay_until },
    reason: reason,
    notes: `Withdrawal delayed for ${days} days`
  });
};

// Add admin methods to EscrowAccount schema
escrowAccountSchema.methods.adminFreeze = function(adminId, reason) {
  this.frozen = true;
  this.freeze_reason = reason;
  
  return new AdminAction({
    admin_id: adminId,
    action_type: 'account_freeze',
    target_type: 'escrow_account',
    target_id: this._id,
    previous_state: { frozen: false },
    new_state: { frozen: true },
    reason: reason
  });
};

escrowAccountSchema.methods.adminAdjustBalance = function(adminId, amount, reason) {
  const previousBalance = this.balance;
  this.balance += amount; // amount can be negative for deductions
  
  return new AdminAction({
    admin_id: adminId,
    action_type: 'system_adjustment',
    target_type: 'escrow_account',
    target_id: this._id,
    previous_state: { balance: previousBalance },
    new_state: { balance: this.balance },
    reason: reason
  });
};

// Add admin methods to Dispute schema
disputeSchema.methods.adminAssign = function(adminId, assignToAdminId) {
  this.assigned_admin = assignToAdminId;
  
  return new AdminAction({
    admin_id: adminId,
    action_type: 'dispute_assignment',
    target_type: 'dispute',
    target_id: this._id,
    previous_state: { assigned_admin: null },
    new_state: { assigned_admin: assignToAdminId },
    reason: 'Dispute assignment'
  });
};

disputeSchema.methods.adminResolve = function(adminId, resolutionType, clientAmount, freelancerAmount, notes) {
  const previousStatus = this.status;
  this.resolve(resolutionType, clientAmount, freelancerAmount, notes);
  
  return new AdminAction({
    admin_id: adminId,
    action_type: 'dispute_resolution',
    target_type: 'dispute',
    target_id: this._id,
    previous_state: { status: previousStatus },
    new_state: { 
      status: DISPUTE_STATUS.RESOLVED,
      resolution_type: resolutionType,
      resolution_amount_client: clientAmount,
      resolution_amount_freelancer: freelancerAmount
    },
    reason: 'Dispute resolution',
    notes: notes
  });
};

const AdminAction = mongoose.model('AdminAction', adminActionSchema);
const AdminPermission = mongoose.model('AdminPermission', adminPermissionSchema);