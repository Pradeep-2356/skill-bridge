import mongoose from 'mongoose';

/**
 * One row per issued refresh token. Only the SHA-256 hash is stored.
 * `family` groups every token that descends from one login, so reuse of an
 * already-rotated token can revoke the whole chain.
 */
const refreshTokenSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    tokenHash: { type: String, required: true, unique: true },
    family: { type: String, required: true, index: true },
    expiresAt: { type: Date, required: true },
    revokedAt: { type: Date, default: null },
    replacedByHash: { type: String, default: null },
    userAgent: { type: String, maxlength: 300, default: '' },
  },
  { timestamps: true },
);

// MongoDB deletes rows automatically once they expire.
refreshTokenSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export const RefreshToken = mongoose.models.RefreshToken || mongoose.model('RefreshToken', refreshTokenSchema);
