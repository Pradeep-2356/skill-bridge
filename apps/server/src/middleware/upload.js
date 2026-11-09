import multer from 'multer';
import { AVATAR_MIME_TYPES, ERROR_CODES } from '@skillbridge/shared';
import { AppError } from '../utils/AppError.js';

/**
 * Accepts one image in memory (field "avatar"). Size is limited here; the real
 * content type is checked from the file bytes in the service (SB1/US17).
 */
export function avatarUpload(maxMb) {
  return multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: Math.round(maxMb * 1024 * 1024), files: 1 },
    fileFilter(_req, file, cb) {
      if (!AVATAR_MIME_TYPES.includes(file.mimetype)) {
        cb(new AppError(415, ERROR_CODES.UNSUPPORTED_FILE_TYPE, 'Please upload a JPEG, PNG or WebP image.'));
        return;
      }
      cb(null, true);
    },
  }).single('avatar');
}
