export type AuthUser = { id: number; role: 'admin' | 'farmer' | 'customer' | 'equipmetal'; name?: string | null; email?: string | null; phone?: string | null };
export type AuthState = { token: string; user: AuthUser };

const KEY = 'km_auth';

export function saveAuth(state: AuthState) {
  if (typeof window === 'undefined') return;
  localStorage.setItem(KEY, JSON.stringify(state));
}

export function getAuth(): AuthState | null {
  if (typeof window === 'undefined') return null;
  const raw = localStorage.getItem(KEY);
  if (!raw) return null;
  try { return JSON.parse(raw) as AuthState; } catch {
    localStorage.removeItem(KEY);
    return null;
  }
}

export function clearAuth() {
  if (typeof window === 'undefined') return;
  localStorage.removeItem(KEY);
}
