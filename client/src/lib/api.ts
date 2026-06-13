import { storage } from './storage';

export class ApiError extends Error {
  status: number;
  code: string;
  details?: { field?: string; message: string }[] | Record<string, unknown>;
  requestId?: string;

  constructor(status: number, code: string, message: string, details?: ApiError['details'], requestId?: string) {
    super(message);
    this.status = status;
    this.code = code;
    this.details = details;
    this.requestId = requestId;
  }
}

let authToken: string | null = storage.getItem('ao_token');

export function setAuthToken(token: string | null) {
  authToken = token;
  if (token) storage.setItem('ao_token', token);
  else storage.removeItem('ao_token');
}

export function getAuthToken() {
  return authToken;
}

interface RequestOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  body?: unknown;
}

export async function api<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const headers: Record<string, string> = {};
  if (options.body !== undefined) headers['Content-Type'] = 'application/json';
  if (authToken) headers['Authorization'] = `Bearer ${authToken}`;

  let res: Response;
  try {
    res = await fetch(`/api${path}`, {
      method: options.method ?? 'GET',
      headers,
      body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
    });
  } catch {
    throw new ApiError(0, 'NETWORK_ERROR', 'Could not reach the server. Is the API running?');
  }

  if (res.status === 204) return undefined as T;

  let data: unknown;
  try {
    data = await res.json();
  } catch {
    throw new ApiError(res.status, 'BAD_RESPONSE', `Unexpected response (${res.status})`);
  }

  if (!res.ok) {
    const err = (data as { error?: { code?: string; message?: string; details?: ApiError['details']; requestId?: string } }).error;
    throw new ApiError(
      res.status,
      err?.code ?? 'UNKNOWN_ERROR',
      err?.message ?? `Request failed (${res.status})`,
      err?.details,
      err?.requestId
    );
  }
  return data as T;
}
