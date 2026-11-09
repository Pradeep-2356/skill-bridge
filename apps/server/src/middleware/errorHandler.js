import multer from 'multer';
import { ERROR_CODES } from '@skillbridge/shared';
import { AppError } from '../utils/AppError.js';
import { logger } from '../utils/logger.js';

/** 404 for unknown API routes. */
export function notFound(req, _res, next) {
  next(AppError.notFound(`No API route matches ${req.method} ${req.originalUrl}`));
}

/** Translates known library errors into AppErrors with the right status. */
function normalise(err) {
  if (err instanceof AppError) return err;

  if (err instanceof multer.MulterError) {
    if (err.code === 'LIMIT_FILE_SIZE') {
      return new AppError(413, ERROR_CODES.FILE_TOO_LARGE, 'That image is too large. The limit is 2 MB.');
    }
    return AppError.badRequest('The upload could not be processed.');
  }
  if (err?.type === 'entity.parse.failed') return AppError.badRequest('The request body is not valid JSON.');
  if (err?.type === 'entity.too.large') {
    return new AppError(413, ERROR_CODES.FILE_TOO_LARGE, 'The request body is too large.');
  }
  if (err?.name === 'CastError') return AppError.badRequest('One of the ids in this request is not valid.');
  if (err?.name === 'ValidationError' && err.errors) {
    const fields = {};
    for (const [path, detail] of Object.entries(err.errors)) fields[path] = detail.message;
    return AppError.validation(fields);
  }
  if (err?.code === 11000) {
    if (err.keyPattern?.email) {
      return AppError.conflict(ERROR_CODES.EMAIL_TAKEN, 'An account with this email already exists.', {
        fields: { email: 'An account with this email already exists. Try logging in instead.' },
      });
    }
    return AppError.conflict('DUPLICATE', 'That item already exists.');
  }
  return null;
}

/** Central error handler: one JSON shape for every failure (SB1/US42). Express needs all 4 arguments. */
export function errorHandler(err, req, res, _next) {
  let error = normalise(err);
  if (!error) {
    logger.error(`${req.method} ${req.originalUrl}`, err);
    error = new AppError(500, ERROR_CODES.INTERNAL_ERROR, 'Something went wrong on our side. Please try again.');
  }
  const body = { success: false, error: { code: error.code, message: error.message } };
  if (error.fields) body.error.fields = error.fields;
  if (error.details) body.error.details = error.details;
  res.status(error.status).json(body);
}
