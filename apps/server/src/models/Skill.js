import mongoose from 'mongoose';
import { SKILL_STATUS, normalizeSkillName } from '@skillbridge/shared';

/**
 * The shared skill catalogue. Users point to these documents from their
 * teach/learn lists, so "React" is the same thing for everyone.
 * Custom skills typed by users start as `pending` for admin review (Sprint 2).
 */
const skillSchema = new mongoose.Schema(
  {
    // 1 character allowed for catalogue entries such as "C"; user-typed skills need 2 (shared schema).
    name: { type: String, required: true, trim: true, minlength: 1, maxlength: 60 },
    normalizedName: { type: String, required: true, unique: true },
    aliases: { type: [String], default: [] },
    category: { type: mongoose.Schema.Types.ObjectId, ref: 'Category', required: true },
    description: { type: String, trim: true, maxlength: 300, default: '' },
    status: { type: String, enum: Object.values(SKILL_STATUS), default: SKILL_STATUS.APPROVED },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  },
  { timestamps: true },
);

skillSchema.index({ aliases: 1 });
skillSchema.index({ category: 1, status: 1 });
// SB2/US33, US34 – full-text index over the searchable skill metadata.
skillSchema.index(
  { name: 'text', aliases: 'text', description: 'text' },
  { name: 'skill_text', weights: { name: 10, aliases: 5, description: 1 }, default_language: 'english' },
);

// Keep normalizedName/aliases consistent whatever the caller passes in.
skillSchema.pre('validate', function normalize() {
  this.normalizedName = normalizeSkillName(this.name);
  this.aliases = [...new Set((this.aliases || []).map(normalizeSkillName).filter(Boolean))];
});

export const Skill = mongoose.models.Skill || mongoose.model('Skill', skillSchema);
