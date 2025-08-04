import mongoose from 'mongoose'

const SubscriptionPriceSchema = new mongoose.Schema({
  consultant: {
    monthly: { type: Number, required: true },
    annual: { type: Number, required: true }
  },
  client: {
    monthly: { type: Number, required: true },
    annual: { type: Number, required: true }
  }
}, { _id: false })

const AdminSubscriptionSettingsSchema = new mongoose.Schema({
  subscriptionPricing: {
    type: SubscriptionPriceSchema,
    required: true
  },
  gccDiscount: {
    token: { type: String, required: true },
    percentOff: { type: Number, required: true, min: 0, max: 100 }
  },
  adminFeePercent: {
    type: Number,
    required: true,
    min: 0,
    max: 100
  },
  tips: String,
  earlyAccessDurationHours: {
    type: Number,
    enum: [24, 48],
    default: 24
  }
}, {
  timestamps: true
})


const AdminSubscriptionSettings = mongoose.model('AdminSubscriptionSettings', AdminSubscriptionSettingsSchema)

export default AdminSubscriptionSettings;