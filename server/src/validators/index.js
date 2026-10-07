/**
 * Validation middleware factory.
 * Turns a Zod schema into an Express middleware that rewrites
 * req.body / req.query / req.params with the parsed (typed) values.
 */
import { unprocessable } from '../utils/errors.js';

const flatten = (issues) =>
  issues.map((issue) => {
    const path = issue.path.join('.');
    let message = issue.message;
    // Normalise a few zod defaults into friendly copy.
    if (message === 'Required') message = 'This field is required.';
    if (message === 'Invalid input') message = 'This value is not valid.';
    return { field: path || 'form', message };
  });

export const validate = (schema, source = 'body') => (req, _res, next) => {
  const result = schema.safeParse(req[source]);
  if (!result.success) {
    const details = flatten(result.error.issues);
    const summary = details.length === 1 ? details[0].message : 'Please correct the highlighted fields and try again.';
    return next(unprocessable(summary, details));
  }
  if (source === 'query') req.validatedQuery = result.data;
  else req[source] = result.data;
  return next();
};

export default validate;
