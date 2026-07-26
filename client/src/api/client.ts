const BASE_URL = '/api';

export class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
    this.name = 'ApiError';
  }
}

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const isFormData = options?.body instanceof FormData;
  const fetchOptions: RequestInit = {
    ...options,
    headers: isFormData
      ? (options?.headers || {})
      : { 'Content-Type': 'application/json', ...options?.headers },
  };

  const res = await fetch(`${BASE_URL}${path}`, fetchOptions);

  const json = await res.json().catch(() => ({
    success: false,
    error: { message: res.statusText },
  }));

  if (!res.ok || !json.success) {
    throw new ApiError(res.status, json.error?.message || 'Request failed');
  }

  return json.data !== undefined ? json.data : json;
}

export const api = {
  get: <T>(path: string) => request<T>(path),
  post: <T>(path: string, body?: any) =>
    request<T>(path, {
      method: 'POST',
      body: body instanceof FormData ? body : JSON.stringify(body),
    }),
  put: <T>(path: string, body?: any) =>
    request<T>(path, {
      method: 'PUT',
      body: JSON.stringify(body),
    }),
  patch: <T>(path: string, body?: any) =>
    request<T>(path, {
      method: 'PATCH',
      body: JSON.stringify(body),
    }),
  delete: <T>(path: string) =>
    request<T>(path, { method: 'DELETE' }),
};