
const lockSchema = new Schema({
    key: { type: String, unique: true, required: true },
    expires_at: { type: Date, required: true },
    created_at: { type: Date, default: Date.now }
  });
  
  lockSchema.index({ expires_at: 1 }, { expireAfterSeconds: 0 });
  const Lock = mongoose.model('Lock', lockSchema);