import mongoose from 'mongoose';
import { isShortCode } from './paths.js';
import { maxDestinationLength } from './validation.js';

const schema = new mongoose.Schema({
  ownerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, immutable: true },
  destination: { type: String, required: true, maxlength: maxDestinationLength },
  shortCode: { type: String, required: true, unique: true, immutable: true, validate: isShortCode },
  codeType: { type: String, enum: ['automatic', 'custom'], required: true, immutable: true },
  expiresAt: { type: Date, default: null },
  enabled: { type: Boolean, default: true },
  securityBlocked: { type: Boolean, default: false },
  deletedAt: { type: Date, default: null },
  lifetimeClicks: { type: Number, min: 0, default: 0 },
  tags: { type: [String], default: [] },
}, { timestamps: true });

schema.index({ ownerId: 1, deletedAt: 1, createdAt: -1, _id: -1 });

export const Link = mongoose.model('Link', schema);
