import mongoose from 'mongoose';
import mongoosePaginate from 'mongoose-paginate-v2';

const withdrawalSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  amount: {
    type: Number,
    required: true,
    min: 0.01
  },
  currency: {
    type: String,
    default: 'USD'
  },
  status: {
    type: String,
    enum: ['pending', 'completed', 'failed'],
    default: 'pending'
  },
  payoutId: {
    type: String,
    required: true
  },
  bankAccount: {
    id: String,
    bankName: String,
    last4: String
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
}, { timestamps: true });

withdrawalSchema.plugin(mongoosePaginate);

const Withdrawal = mongoose.model('Withdrawal', withdrawalSchema);
export default Withdrawal;