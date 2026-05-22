const BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';

function getToken(): string | null {
  return sessionStorage.getItem('token');
}

function getRefreshToken(): string | null {
  return sessionStorage.getItem('refresh_token');
}

function clearTokens(): void {
  sessionStorage.removeItem('token');
  sessionStorage.removeItem('refresh_token');
  sessionStorage.removeItem('user');
}

export function isTokenExpiringSoon(token: string): boolean {
  try {
    const payload = JSON.parse(atob(token.split('.')[1]));
    const expiresAt = payload.exp * 1000;
    const fiveMinutes = 5 * 60 * 1000;
    return expiresAt - Date.now() < fiveMinutes;
  } catch {
    return true;
  }
}

let refreshPromise: Promise<string> | null = null;

async function refreshAccessToken(): Promise<string> {
  const refreshToken = getRefreshToken();
  if (!refreshToken) throw new Error('No refresh token');

  const res = await fetch(`${BASE_URL}/auth/refresh`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ refresh_token: refreshToken }),
  });

  if (!res.ok) {
    clearTokens();
    window.location.href = '/login';
    throw new Error('Refresh failed');
  }

  const data = await res.json();
  sessionStorage.setItem('token', data.token);
  sessionStorage.setItem('refresh_token', data.refresh_token);
  return data.token;
}

async function ensureFreshToken(): Promise<string | null> {
  const token = getToken();
  if (!token) return null;

  if (!isTokenExpiringSoon(token)) return token;

  // Deduplicate concurrent refresh calls
  if (!refreshPromise) {
    refreshPromise = refreshAccessToken().finally(() => {
      refreshPromise = null;
    });
  }

  return refreshPromise;
}

async function request<T>(method: string, path: string, body?: unknown): Promise<T> {
  // Ensure fresh token before making the request (skip for auth routes)
  if (!path.startsWith('/auth/')) {
    await ensureFreshToken();
  }

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };

  const token = getToken();
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const res = await fetch(`${BASE_URL}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });

  if (!res.ok) {
    const data = await res.json().catch(() => ({ error: 'Erro desconhecido' }));

    // Only auto-redirect on 401 for non-auth routes (auth routes handle their own errors)
    if (res.status === 401 && !path.startsWith('/auth/')) {
      clearTokens();
      window.location.href = '/login';
    }

    throw new ApiError(res.status, data.error || 'Erro desconhecido', data.details);
  }

  if (res.status === 204) return undefined as T;
  return res.json();
}

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
    public details?: unknown,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

export async function uploadFile(file: File): Promise<{ url: string }> {
  // Ensure fresh token before upload
  await ensureFreshToken();

  const token = getToken();
  const formData = new FormData();
  formData.append('file', file);

  const res = await fetch(`${BASE_URL}/upload`, {
    method: 'POST',
    headers: token ? { Authorization: `Bearer ${token}` } : {},
    body: formData,
  });

  if (!res.ok) {
    const data = await res.json().catch(() => ({ error: 'Erro no upload' }));

    if (res.status === 401) {
      clearTokens();
      window.location.href = '/login';
    }

    throw new ApiError(res.status, data.error || 'Erro no upload');
  }

  return res.json();
}

const api = {
  get: <T>(path: string) => request<T>('GET', path),
  post: <T>(path: string, body?: unknown) => request<T>('POST', path, body),
  put: <T>(path: string, body?: unknown) => request<T>('PUT', path, body),
  patch: <T>(path: string, body?: unknown) => request<T>('PATCH', path, body),
  delete: <T>(path: string) => request<T>('DELETE', path),
};

export default api;
