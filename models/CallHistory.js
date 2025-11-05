import mongoose from 'mongoose';

const callHistorySchema = new mongoose.Schema({
  customerId: { type: mongoose.Schema.Types.ObjectId, ref: 'Customer', required: true },
  agentId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  interested: { type: Boolean },
  callTime: { type: Date, default: Date.now },
  disposition: { type: String },
  nextCallDateTime: { type: Date },
  attended: { type: Boolean },
  notes: { type: String },
}, { timestamps: true });

export default mongoose.model('CallHistory', callHistorySchema);
