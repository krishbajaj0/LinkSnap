import mongoose from 'mongoose';

export const emailPattern = /^[a-z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-z0-9](?:[a-z0-9-]*[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]*[a-z0-9])?)+$/i;

const userSchema = new mongoose.Schema({
  email: { type: String, required: true, trim: true, lowercase: true, maxlength: 254, match: emailPattern, unique: true },
  name: { type: String, required: true, trim: true, maxlength: 80 },
  passwordHash: { type: String, required: true, select: false },
  role: { type: String, enum: ['user', 'admin'], default: 'user', required: true },
  sessionVersion: { type: Number, default: 0, required: true, min: 0 },
}, { timestamps: true });

const sessionSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  sessionVersion: { type: Number, required: true },
  tokenHash: { type: String, required: true, select: false },
  generation: { type: Number, required: true, min: 0 },
  rotatedAt: Date,
  expiresAt: { type: Date, required: true, expires: 0 },
  revokedAt: { type: Date, default: null },
}, { timestamps: true });

sessionSchema.index({ userId: 1, sessionVersion: 1, revokedAt: 1 });

export const User = mongoose.model('User', userSchema);
export const Session = mongoose.model('Session', sessionSchema);
