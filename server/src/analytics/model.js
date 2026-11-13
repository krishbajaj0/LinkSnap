import mongoose from 'mongoose';

export const dayMs = 86_400_000;
export const retentionDays = 90;

const schema = new mongoose.Schema({
  linkId: { type: mongoose.Schema.Types.ObjectId, ref: 'Link', required: true },
  ownerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  timestamp: { type: Date, required: true, expires: retentionDays * 86_400 },
  device: { type: String, enum: ['Desktop', 'Mobile', 'Tablet', 'Other', 'Unknown'], required: true },
  browser: { type: String, required: true, maxlength: 32 },
  os: { type: String, required: true, maxlength: 32 },
  country: { type: String, required: true, maxlength: 7 },
  referrer: { type: String, required: true, maxlength: 253 },
  bot: { type: Boolean, required: true },
  visitorId: { type: String, default: null, select: false },
}, { collection: 'clickEvents', versionKey: false });

schema.index({ ownerId: 1, timestamp: -1, _id: -1 });
schema.index({ ownerId: 1, linkId: 1, timestamp: -1, _id: -1 });

export const ClickEvent = mongoose.model('ClickEvent', schema);
