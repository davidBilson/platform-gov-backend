import mongoose from 'mongoose';

const vettingLogSchema = new mongoose.Schema({
    vetter: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Vetter',
        required: [true, 'Log must reference a vetter']
    },
    consultant: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: [true, 'Log must reference a consultant'],
        index: true
    },
    action: {
        type: String,
        enum: ['added', 'confirmed', 'rejected', 'reminder_sent', 'removed', 'status_changed'],
        required: [true, 'Action is required'],
        index: true
    },
    metadata: {
        type: mongoose.Schema.Types.Mixed,
        default: {}
    },
    ipAddress: {
        type: String,
        trim: true
    },
    userAgent: {
        type: String,
        trim: true
    },
    createdAt: {
        type: Date,
        default: Date.now,
        index: true
    }
}, {
    timestamps: false // We only want createdAt
});

// Indexes for performance
vettingLogSchema.index({ consultant: 1, createdAt: -1 });
vettingLogSchema.index({ vetter: 1, createdAt: -1 });
vettingLogSchema.index({ action: 1, createdAt: -1 });

// Compound index for common queries
vettingLogSchema.index({ consultant: 1, action: 1, createdAt: -1 });

const VettingLog = mongoose.model('VettingLog', vettingLogSchema);
export default VettingLog;






