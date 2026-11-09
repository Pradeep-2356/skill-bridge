import { ERROR_CODES } from '@skillbridge/shared';

/**
 * An expected, user-facing error. Anything thrown that is NOT an AppError
 * becomes a generic 500 so internal details never reach the client (SB1/US42).
 */
export class AppError extends Error {
  constructor(status, code, message, { fields, details } = {}) {
    super(message);
    this.name = 'AppError';
    this.status = status;
    this.code = code;
    if (fields) this.fields = fields;
    if (details) this.details = details;
  }

  static badRequest(message = 'The request could not be understood.', opts) {
    return new AppError(400, ERROR_CODES.BAD_REQUEST, message, opts);
  }

  static validation(fields, message = 'Please fix the highlighted fields.') {
    return new AppError(422, ERROR_CODES.VALIDATION_ERROR, message, { fields });
  }

  static unauthenticated(message = 'Please log in to continue.') {
    return new AppError(401, ERROR_CODES.UNAUTHENTICATED, message);
  }

  static forbidden(message = 'You do not have permission to do that.') {
    return new AppError(403, ERROR_CODES.FORBIDDEN, message);
  }

  static notFound(message = 'We could not find what you were looking for.') {
    return new AppError(404, ERROR_CODES.NOT_FOUND, message);
  }

  static conflict(code, message, opts) {
    return new AppError(409, code, message, opts);
  }
}
