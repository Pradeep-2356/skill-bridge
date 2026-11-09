import mongoose from 'mongoose';

const categorySchema = new mongoose.Schema(
  {
    name: { type: String, required: true, unique: true, trim: true, minlength: 2, maxlength: 50 },
    slug: { type: String, required: true, unique: true, lowercase: true, trim: true },
    description: { type: String, trim: true, maxlength: 200, default: '' },
    /** Name of a Lucide icon, e.g. "code" or "palette". */
    icon: { type: String, default: 'tag' },
    isActive: { type: Boolean, default: true },
    order: { type: Number, default: 0 },
  },
  { timestamps: true },
);

export const Category = mongoose.models.Category || mongoose.model('Category', categorySchema);
