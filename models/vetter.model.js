import mongoose from 'mongoose';

const vetterSchema = new mongoose.Schema({
    consultant: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: [true, 'Vetter must belong to a consultant'],
        index: true
    },
    name: {
        type: String,
        required: [true, 'Vetter name is required'],
        trim: true
    },
    email: {
        type: String,
        required: [true, 'Vetter email is required'],
        lowercase: true,
        trim: true,
        validate: {
            validator: function (email) {
                return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
            },
            message: 'Please provide a valid email address'
        }
    },
    linkedinUrl: {
        type: String,
        trim: true,
        default: '',
        validate: {
            validator: function (url) {
                if (!url) return true; // Optional field
                return /^https?:\/\/(www\.)?linkedin\.com\/in\/[\w-]+\/?$/.test(url);
            },
            message: 'Please provide a valid LinkedIn profile URL'
        }
    },
    status: {
        type: String,
        enum: ['pending', 'confirmed', 'rejected'],
        default: 'pending'
    },
    confirmationToken: {
        type: String,
        unique: true,
        sparse: true
    },
    confirmationTokenExpiry: {
        type: Date,
        index: { expireAfterSeconds: 0 } // TTL index for auto-deletion
    },
    confirmationTimestamp: {
        type: Date
    },
    reminderSentAt: {
        type: Date
    },
    reminderCount: {
        type: Number,
        default: 0
    },
    deletedAt: {
        type: Date,
        default: null
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

// Indexes for performance
vetterSchema.index({ consultant: 1, status: 1 });
vetterSchema.index({ consultant: 1, email: 1 }, { unique: true, partialFilterExpression: { deletedAt: null } });
vetterSchema.index({ confirmationToken: 1 });
vetterSchema.index({ createdAt: 1 });

// Prevent duplicate emails for same consultant (soft-delete aware)
vetterSchema.pre('save', async function (next) {
    if (this.isNew && !this.deletedAt) {
        const existingVetter = await mongoose.model('Vetter').findOne({
            consultant: this.consultant,
            email: this.email,
            deletedAt: null
        });

        if (existingVetter) {
            return next(new Error('A vetter with this email already exists for this consultant'));
        }
    }
    next();
});

// Update timestamp on save
vetterSchema.pre('save', function (next) {
    this.updatedAt = Date.now();
    next();
});

// Instance method to check if token is valid
vetterSchema.methods.isTokenValid = function () {
    if (!this.confirmationTokenExpiry) return false;
    return this.confirmationTokenExpiry > new Date();
};

// Static method to find active vetters (not deleted)
vetterSchema.statics.findActive = function (query = {}) {
    return this.find({ ...query, deletedAt: null });
};

const Vetter = mongoose.model('Vetter', vetterSchema);
export default Vetter;

