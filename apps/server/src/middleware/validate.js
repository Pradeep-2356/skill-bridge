import { toFieldErrors } from '@skillbridge/shared';
import { AppError } from '../utils/AppError.js';

/**
 * Validates request parts with Zod schemas and stores the parsed (trimmed,
 * coerced) values on `req.validated`. Express 5 makes `req.query` read-only,
 * so handlers always read from `req.validated`.
 *
 *   router.post('/register', validate({ body: registerSchema }), controller)
 */
export function validate(schemas) {
  return function validateRequest(req, _res, next) {
    req.validated = req.validated ?? {};
    for (const [part, schema] of Object.entries(schemas)) {
      const result = schema.safeParse(req[part] ?? {});
      if (!result.success) throw AppError.validation(toFieldErrors(result.error));
      req.validated[part] = result.data;
    }
    next();
  };
}
