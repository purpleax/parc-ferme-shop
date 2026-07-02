import { ApiError } from './api';

// Zod validation failures arrive as `details: [{ field, message }]` on the
// error envelope — map them to per-field messages for form highlighting.
export function extractFieldErrors(err: unknown): Record<string, string> {
  if (err instanceof ApiError && Array.isArray(err.details)) {
    return Object.fromEntries(err.details.map((d) => [d.field ?? '', d.message]));
  }
  return {};
}

export function getErrorMessage(err: unknown, fallback = 'Something went wrong'): string {
  if (err instanceof ApiError) return err.message;
  return fallback;
}
