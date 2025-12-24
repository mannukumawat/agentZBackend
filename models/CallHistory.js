import mongoose from 'mongoose';

const callHistorySchema = new mongoose.Schema({
  customerId: { type: mongoose.Schema.Types.ObjectId, ref: 'Customer', required: true },
  agentId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },

  interested: { type: Boolean },
  attended: { type: Boolean },

  disposition: { type: String },
  notes: { type: String },

  // ✅ EPOCH (milliseconds)
  callTime: { type: Number, default: () => Date.now() },
  nextCallDateTime: { type: Number },

}, { timestamps: true });

export default mongoose.model('CallHistory', callHistorySchema);
