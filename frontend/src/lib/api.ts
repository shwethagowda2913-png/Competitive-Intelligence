export class ApiError extends Error {
  status: number; detail: any;
  constructor(status: number, message: string, detail?: any) { super(message); this.status = status; this.detail = detail; }
}

async function req<T>(method: string, path: string, body?: unknown): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`/api${path}`, { method, headers: body ? { "Content-Type": "application/json" } : undefined, body: body ? JSON.stringify(body) : undefined });
  } catch {
    throw new ApiError(0, "Cannot reach the backend. Start it with: uvicorn app.main:app --port 8000");
  }
  if (res.status === 204) return undefined as T;
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const e = data?.error;
    const msg = e?.fields?.length ? e.fields.map((f: any) => `${f.field}: ${f.message}`).join("; ") : e?.message || `Request failed (${res.status})`;
    throw new ApiError(res.status, msg, e);
  }
  return data as T;
}

export const api = {
  get: <T = any>(p: string) => req<T>("GET", p),
  post: <T = any>(p: string, b?: unknown) => req<T>("POST", p, b ?? {}),
  put: <T = any>(p: string, b: unknown) => req<T>("PUT", p, b),
  patch: <T = any>(p: string, b: unknown) => req<T>("PATCH", p, b),
  del: (p: string) => req<void>("DELETE", p),
};

export const qs = (o: Record<string, any>) => {
  const p = new URLSearchParams();
  Object.entries(o).forEach(([k, v]) => v !== undefined && v !== null && v !== "" && p.set(k, String(v)));
  const s = p.toString();
  return s ? `?${s}` : "";
};

export const CATEGORIES = ["pricing", "product_launch", "marketing", "hiring", "market_expansion", "other"] as const;
export const STRATEGIES = ["broad_discount", "targeted_discount", "feature_bundle", "no_response", "other"] as const;
export const nice = (s?: string | null) => (s ? s.replace(/_/g, " ") : "—");
export const pct = (x: number | null | undefined) => (x === null || x === undefined ? "n/a" : `${x > 0 ? "+" : ""}${x.toFixed(1)}%`);
export const fdate = (d?: string | null) => (d ? new Date(d).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" }) : "undated");
export const fdt = (d?: string | null) => (d ? new Date(d.endsWith("Z") ? d : d + "Z").toLocaleString() : "");
