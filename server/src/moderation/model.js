import mongoose from 'mongoose';

export const reasons = ['phishing', 'malware', 'spam', 'impersonation', 'other'];
export const reportStatuses = ['pending', 'reviewed', 'dismissed', 'actioned'];

export const auditSchema = new mongoose.Schema({
  moderatorId: { type: mongoose.Schema.Types.ObjectId, required: true },
  reportId: mongoose.Schema.Types.ObjectId,
  action: { type: String, enum: ['review', 'dismiss', 'actioned', 'block', 'unblock'], required: true },
  note: { type: String, maxlength: 500, default: '' },
  timestamp: { type: Date, required: true },
}, { _id: false });

const reportSchema = new mongoose.Schema({
  linkId: { type: mongoose.Schema.Types.ObjectId, ref: 'Link', required: true, immutable: true },
  reason: { type: String, enum: reasons, required: true, immutable: true },
  description: { type: String, maxlength: 500, default: '', immutable: true },
  fingerprint: { type: String, required: true, unique: true, select: false, immutable: true },
  status: { type: String, enum: reportStatuses, default: 'pending' },
  moderatorId: mongoose.Schema.Types.ObjectId,
  decision: { type: String, enum: ['review', 'dismiss', 'actioned'] },
  notes: { type: String, maxlength: 500, default: '' },
  moderationHistory: { type: [auditSchema], default: [] },
}, { timestamps: true, collection: 'reports' });

reportSchema.index({ status: 1, createdAt: -1, _id: -1 });
reportSchema.index({ createdAt: -1, _id: -1 });
reportSchema.index({ linkId: 1, createdAt: -1 });
export const Report = mongoose.model('Report', reportSchema);
