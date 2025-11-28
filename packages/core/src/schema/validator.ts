import Ajv from 'ajv';
import addFormats from 'ajv-formats';
import type { JSONSchema } from './loader';

const ajv = new Ajv({
  allErrors: true,
  verbose: true,
  strict: false,
});
addFormats(ajv);

export interface ValidationError {
  path: string;
  message: string;
  keyword: string;
}

export interface ValidationResult {
  valid: boolean;
  errors: ValidationError[];
}

export function validateAgainstSchema(
  data: unknown,
  schema: JSONSchema
): ValidationResult {
  const validate = ajv.compile(schema);
  const valid = validate(data);

  if (valid) {
    return { valid: true, errors: [] };
  }

  const errors: ValidationError[] = (validate.errors ?? []).map((err) => ({
    path: err.instancePath || '/',
    message: err.message ?? 'Validation error',
    keyword: err.keyword,
  }));

  return { valid: false, errors };
}
