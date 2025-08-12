import mongoose from "mongoose";

const discountTokenSchema = new mongoose.Schema({
    token: {
        type: String,
        required: true,
        unique: true,
        trim: true
    },
    discountPercentage: {
        type: Number,
        required: true,
        min: 0,
        max: 100
    },
    createdAt: {
        type: Date,
        default: Date.now,
        expires: '30d' // Token expires after 30 days
    },
    isActive: {
        type: Boolean,
        default: true
    },
}, {
    timestamps: true
});

const DiscountToken = mongoose.model('DiscountToken', discountTokenSchema);
export default DiscountToken;