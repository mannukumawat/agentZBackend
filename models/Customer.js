import mongoose from 'mongoose';
import { encrypt } from '../utils/encryption.js';

const customerSchema = new mongoose.Schema({
  customerName: { type: String, required: true },
  mobileNumbers: [{ type: String }],
  emails: [{ type: String }],
  creditScore: { type: Number },
  address: { type: String },
  pinCode: { type: String },
  gender: { type: String, enum: ['male', 'female', 'other'] },
  occupation: { type: String, enum: ['salary', 'non-salary', 'business', 'other'] },
  income: { type: Number },
  dob: { type: Date },
  aadhaarNumber: { type: String,  },
  panNumber: { type: String,  },
  aadhaarFiles: {
    frontUrl: { type: String },
    backUrl: { type: String },
  },
  panFile: { type: String },
  selfie: { type: String },
  incomeProofFiles: [{ type: String }],
  assignedAgentId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
}, { timestamps: true });

export default mongoose.model('Customer', customerSchema);
