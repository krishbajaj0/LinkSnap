import mongoose from 'mongoose';
import { isShortCode } from './paths.js';
import { maxDestinationLength } from './validation.js';
import { isTag, maxTags } from './tags.js';
import { auditSchema } from '../moderation/model.js';

const schema = new mongoose.Schema({
  ownerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, immutable: true },
  destination: { type: String, required: true, maxlength: maxDestinationLength },
  shortCode: { type: String, required: true, unique: true, immutable: true, validate: isShortCode },
  codeType: { type: String, enum: ['automatic', 'custom'], required: true, immutable: true },
  expiresAt: { type: Date, default: null },
  enabled: { type: Boolean, default: true },
  securityBlocked: { type: Boolean, default: false },
  securityFlags: { type: [String], default: [] },
  securityReviewedAt: { type: Date, default: null },
  moderationHistory: { type: [auditSchema], default: [], select: false },
  deletedAt: { type: Date, default: null },
  lifetimeClicks: { type: Number, min: 0, default: 0 },
  lifetimeHumanClicks: { type: Number, min: 0, default: 0 },
  lifetimeBotClicks: { type: Number, min: 0, default: 0 },
  tags: { type: [String], default: [], validate: (tags) =>
    tags.length <= maxTags && new Set(tags).size === tags.length && tags.every(isTag) },
}, { timestamps: true });

schema.index({ ownerId: 1, deletedAt: 1, createdAt: -1, _id: -1 });
schema.index({ ownerId: 1, deletedAt: 1, updatedAt: -1, _id: -1 });
schema.index({ ownerId: 1, deletedAt: 1, expiresAt: -1, _id: -1 });
schema.index({ ownerId: 1, deletedAt: 1, shortCode: 1 });
schema.index({ ownerId: 1, deletedAt: 1, tags: 1, createdAt: -1, _id: -1 });
schema.index({ deletedAt: 1, securityBlocked: 1, updatedAt: -1, _id: -1 });

export const Link = mongoose.model('Link', schema);
