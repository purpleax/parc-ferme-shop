export class ApiError extends Error {
  status: number;
  code: string;
  details?: unknown;

  constructor(status: number, code: string, message: string, details?: unknown) {
    super(message);
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

export const badRequest = (message: string, details?: unknown) =>
  new ApiError(400, 'VALIDATION_ERROR', message, details);
export const unauthorized = (message = 'Authentication required') =>
  new ApiError(401, 'UNAUTHORIZED', message);
export const invalidCredentials = () =>
  new ApiError(401, 'INVALID_CREDENTIALS', 'Incorrect email or password');
export const forbidden = (message = 'You do not have access to this resource') =>
  new ApiError(403, 'FORBIDDEN', message);
export const notFound = (what = 'Resource') =>
  new ApiError(404, 'NOT_FOUND', `${what} not found`);
export const conflict = (code: string, message: string) => new ApiError(409, code, message);
export const paymentDeclined = (declineCode: string, message: string) =>
  new ApiError(402, 'PAYMENT_DECLINED', message, { declineCode });
