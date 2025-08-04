import mongoose from "mongoose";

const subscriptionSchema = new mongoose.Schema({
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
        index: true
    },
    userType: {
        type: String,
        enum: ['contractor', 'client'],
        required: true
    },
    token: {
        type: String,
        required: true,
        unique: true
    },
    billingInterval: {
        type: String,
        enum: ['monthly', 'annual'],
        required: true
    },
    planName: {
        type: String,
        enum: ['free', 'premium'],
        default: 'premium',
        required: true
    },
    subscriptionAmount: {
        type: Number,
        required: true,
        min: 0
    },
    currency: {
        type: String,
        default: 'USD',
        required: true
    },
    subscriptionPeriod: {
        startDate: {
            type: Date,
            required: true,
            default: Date.now
        },
        endDate: {
            type: Date,
            required: true
        }
    },
    subscriptionPaymentIntent: {
        type: String,
        required: true
    },
    status: {
        type: String,
        enum: ['active', 'cancelled', 'expired', 'pending'],
        default: 'pending'
    },
    autoRenew: {
        type: Boolean,
        default: true
    },
    cancelledAt: {
        type: Date
    },
    cancelReason: {
        type: String
    }
}, {
    timestamps: true
});

// Indexes for better query performance
subscriptionSchema.index({ userId: 1, status: 1 });
subscriptionSchema.index({ 'subscriptionPeriod.endDate': 1 });

// Virtual for checking if subscription is active
subscriptionSchema.virtual('isActive').get(function () {
    return this.status === 'active' &&
        this.subscriptionPeriod.endDate > new Date();
});

// Method to cancel subscription
subscriptionSchema.methods.cancel = function (reason) {
    this.status = 'cancelled';
    this.cancelledAt = new Date();
    this.autoRenew = false;
    if (reason) this.cancelReason = reason;
    return this.save();
};

// Static method to find active subscriptions
subscriptionSchema.statics.findActive = function (userId) {
    return this.find({
        userId,
        status: 'active',
        'subscriptionPeriod.endDate': { $gt: new Date() }
    });
};

const Subscription = mongoose.model("Subscription", subscriptionSchema);

export default Subscription;