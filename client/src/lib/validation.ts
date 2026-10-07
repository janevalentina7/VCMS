/**
 * Client side validation mirroring the server rules (server/src/validators).
 * Client validation is for UX only - the API re-validates everything.
 */
import type { FieldErrors } from '@/types';
import { isEmail, isMobile, isName, isRation, isStrongPassword } from './utils';

export type Validator<T> = (value: T) => string | undefined;

export const required = (label: string): Validator<string> => (value) =>
  value && String(value).trim().length ? undefined : `${label} is required.`;

export const nameRule = (label = 'Name'): Validator<string> => (value) => {
  if (!value?.trim()) return `${label} is required.`;
  if (value.trim().length < 2) return `${label} must be at least 2 characters.`;
  if (value.trim().length > 120) return `${label} must not exceed 120 characters.`;
  if (!isName(value)) return `${label} may contain alphabetic characters and spaces only.`;
  return undefined;
};

export const emailRule: Validator<string> = (value) => {
  if (!value?.trim()) return 'Email address is required.';
  if (!isEmail(value)) return 'Enter a valid email address (for example name@example.com).';
  return undefined;
};

export const mobileRule: Validator<string> = (value) => {
  if (!value?.trim()) return 'Mobile number is required.';
  if (!isMobile(value)) return 'Enter a valid 10 digit Indian mobile number starting with 6, 7, 8 or 9.';
  return undefined;
};

export const rationRule = (required = true): Validator<string> => (value) => {
  if (!value?.trim()) return required ? 'Ration number is required.' : undefined;
  if (!isRation(value)) return 'Ration number must be in the format TN123456789 (2 letters followed by 8-12 digits).';
  return undefined;
};

export const passwordRule: Validator<string> = (value) => {
  if (!value) return 'Password is required.';
  if (value.length < 8) return 'Password must be at least 8 characters long.';
  if (value.length > 72) return 'Password must not exceed 72 characters.';
  if (!isStrongPassword(value)) return 'Password must contain at least one letter and one number.';
  return undefined;
};

export const minLength = (label: string, min: number): Validator<string> => (value) => {
  if (!value?.trim()) return `${label} is required.`;
  if (value.trim().length < min) return `${label} must be at least ${min} characters.`;
  return undefined;
};

export const maxLength = (label: string, max: number): Validator<string> => (value) => {
  if (value && value.trim().length > max) return `${label} must not exceed ${max} characters.`;
  return undefined;
};

export const compose =
  <T,>(...validators: Validator<T>[]): Validator<T> =>
  (value) => {
    for (const validator of validators) {
      const error = validator(value);
      if (error) return error;
    }
    return undefined;
  };

/** Runs a { field: validator } map and returns only the failures. */
export const runValidation = <T extends Record<string, unknown>>(
  values: T,
  rules: Partial<Record<keyof T & string, Validator<never>>>,
): FieldErrors => {
  const errors: FieldErrors = {};
  Object.entries(rules).forEach(([field, validator]) => {
    const error = (validator as Validator<unknown>)(values[field as keyof T]);
    if (error) errors[field] = error;
  });
  return errors;
};

export const hasErrors = (errors: FieldErrors) => Object.keys(errors).length > 0;

/** Validates a single evidence image before upload (mirrors the API limits). */
export const validateImageFile = (file: File, maxMb = 5): string | undefined => {
  const allowed = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
  const ext = `.${file.name.split('.').pop()?.toLowerCase() ?? ''}`;
  if (!allowed.includes(file.type) || !['.jpg', '.jpeg', '.png', '.webp'].includes(ext)) {
    return 'Only JPG, JPEG, PNG and WEBP images are accepted.';
  }
  if (file.size > maxMb * 1024 * 1024) return `File size exceeds the allowed limit of ${maxMb} MB.`;
  return undefined;
};
