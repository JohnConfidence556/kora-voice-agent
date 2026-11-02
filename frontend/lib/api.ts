const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";
const TOKEN_KEY = "demo_token";

export type Profile = {
  id: number;
  email: string;
  demo_number: string;
  sim_status: string;
  plan_name: string;
  plan_expires_at: string | null;
  airtime_naira: number;
  data_mb: number;
};

export type Transaction = {
  id: number;
  kind: string;
  description: string;
  amount_naira: number;
  data_mb: number;
  created_at: string;
};

export type CatalogItem = {
  id: string;
  name: string;
  price: number;
  data_mb: number;
  validity_days: number;
};

export type Order = {
  id: string;
  kind: string;
  item_id: string;
  description: string;
  amount_naira: number;
  data_mb: number;
  validity_days: number;
  status: string;
  created_at: string;
  expires_at: string;
};

export class ApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

// The login token lives in the browser's localStorage (fine for a demo)
export function getToken(): string | null {
  try { return localStorage.getItem(TOKEN_KEY); } catch { return null; }
}
export function setToken(token: string) {
  try { localStorage.setItem(TOKEN_KEY, token); } catch {}
}
export function clearToken() {
  try { localStorage.removeItem(TOKEN_KEY); } catch {}
}

export async function api<T>(path: string, options: RequestInit = {}): Promise<T> {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  const token = getToken();
  if (token) headers.Authorization = `Bearer ${token}`;

  const res = await fetch(`${API_URL}${path}`, { ...options, headers });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new ApiError(data.detail ?? "Something went wrong", res.status);
  return data as T;
}
