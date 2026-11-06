import { createContext, ReactNode, useCallback, useContext, useEffect, useState } from "react";
import { AlertTriangle, CheckCircle2, Info, Loader2, X, XCircle } from "lucide-react";
import { nice } from "../lib/api";

export const cx = (...a: (string | false | null | undefined)[]) => a.filter(Boolean).join(" ");

/* ---------- toasts */
type Toast = { id: number; kind: "ok" | "err" | "info"; text: string };
const ToastCtx = createContext<(kind: Toast["kind"], text: string) => void>(() => {});
export const useToast = () => useContext(ToastCtx);
export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<Toast[]>([]);
  const push = useCallback((kind: Toast["kind"], text: string) => {
    const id = Date.now() + Math.random();
    setItems((s) => [...s, { id, kind, text }]);
    setTimeout(() => setItems((s) => s.filter((t) => t.id !== id)), kind === "err" ? 7000 : 4000);
  }, []);
  return (
    <ToastCtx.Provider value={push}>
      {children}
      <div className="fixed bottom-4 right-4 z-[60] flex w-[min(92vw,380px)] flex-col gap-2" role="status" aria-live="polite">
        {items.map((t) => (
          <div key={t.id} className="card pop flex items-start gap-2 p-3 text-sm">
            {t.kind === "ok" ? <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-good" /> : t.kind === "err" ? <XCircle className="mt-0.5 h-4 w-4 shrink-0 text-bad" /> : <Info className="mt-0.5 h-4 w-4 shrink-0 text-brand" />}
            <span className="flex-1">{t.text}</span>
            <button aria-label="Dismiss" onClick={() => setItems((s) => s.filter((x) => x.id !== t.id))}><X className="h-4 w-4 text-muted" /></button>
          </div>
        ))}
      </div>
    </ToastCtx.Provider>
  );
}

/* ---------- primitives */
export function Button({ variant = "primary", loading, className, children, ...p }: React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: "primary" | "ghost" | "danger" | "memory"; loading?: boolean }) {
  const v = { primary: "bg-brand text-bg hover:opacity-90", ghost: "border border-line bg-raised hover:border-brand/60", danger: "bg-bad text-bg hover:opacity-90", memory: "bg-memory text-bg hover:opacity-90" }[variant];
  return (
    <button {...p} disabled={p.disabled || loading} className={cx("inline-flex items-center justify-center gap-2 rounded-lg px-3.5 py-2 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-50", v, className)}>
      {loading && <Loader2 className="h-4 w-4 animate-spin" />}{children}
    </button>
  );
}
export const Card = ({ className, children }: { className?: string; children: ReactNode }) => <section className={cx("card", className)}>{children}</section>;
export const CardHead = ({ title, sub, right }: { title: ReactNode; sub?: ReactNode; right?: ReactNode }) => (
  <div className="flex items-start justify-between gap-3 border-b border-line px-5 py-3.5">
    <div><h3 className="text-sm font-bold">{title}</h3>{sub && <p className="mt-0.5 text-xs text-muted">{sub}</p>}</div>{right}
  </div>
);
export function PageHeader({ title, sub, actions }: { title: string; sub?: string; actions?: ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
      <div><h1 className="text-2xl font-extrabold tracking-tight">{title}</h1>{sub && <p className="mt-1 max-w-2xl text-sm text-muted">{sub}</p>}</div>
      <div className="flex flex-wrap gap-2">{actions}</div>
    </div>
  );
}
export function Badge({ tone = "neutral", children, title }: { tone?: "neutral" | "good" | "bad" | "warn" | "brand" | "memory"; children: ReactNode; title?: string }) {
  const t = { neutral: "bg-raised text-muted border-line", good: "bg-good/15 text-good border-good/30", bad: "bg-bad/15 text-bad border-bad/30", warn: "bg-warn/15 text-warn border-warn/30", brand: "bg-brand/15 text-brand border-brand/30", memory: "bg-memory/15 text-memory border-memory/30" }[tone];
  return <span title={title} className={cx("inline-flex items-center gap-1 whitespace-nowrap rounded-md border px-2 py-0.5 text-[11px] font-semibold", t)}>{children}</span>;
}
export const SimBadge = () => <Badge tone="warn" title="Synthetic demo data — not real-world evidence">Simulated</Badge>;
export const VerifBadge = ({ s }: { s: string }) => <Badge tone={s === "verified" ? "good" : s === "disputed" ? "bad" : "neutral"}>{s}</Badge>;
const CAT_TONE: Record<string, any> = { pricing: "warn", product_launch: "brand", marketing: "memory", hiring: "neutral", market_expansion: "good", other: "neutral" };
export const CatBadge = ({ c }: { c: string }) => <Badge tone={CAT_TONE[c] || "neutral"}>{nice(c)}</Badge>;
const V_TONE: Record<string, any> = { supported: "good", success: "good", failed: "bad", failure: "bad", mixed: "warn", pending: "neutral", unmeasured: "neutral" };
export const VerdictBadge = ({ v }: { v: string }) => <Badge tone={V_TONE[v] || "neutral"}>{v}</Badge>;

/* ---------- forms */
export const Field = ({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) => (
  <label className="block"><span className="label">{label}</span>{children}{hint && <span className="mt-1 block text-[11px] text-muted">{hint}</span>}</label>
);
export const Input = (p: React.InputHTMLAttributes<HTMLInputElement>) => <input {...p} className={cx("input", p.className)} />;
export const Textarea = (p: React.TextareaHTMLAttributes<HTMLTextAreaElement>) => <textarea rows={3} {...p} className={cx("input", p.className)} />;
export const Select = (p: React.SelectHTMLAttributes<HTMLSelectElement>) => <select {...p} className={cx("input", p.className)} />;

/* ---------- states */
export const Skeleton = ({ className }: { className?: string }) => <div className={cx("skeleton h-4", className)} />;
export const PageSkeleton = () => <div className="space-y-4"><Skeleton className="h-8 w-64" /><div className="grid grid-cols-2 gap-4 lg:grid-cols-4">{[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-24" />)}</div><Skeleton className="h-64" /></div>;
export function Empty({ title, text, action }: { title: string; text?: string; action?: ReactNode }) {
  return <div className="flex flex-col items-center gap-2 px-6 py-12 text-center"><p className="font-bold">{title}</p>{text && <p className="max-w-md text-sm text-muted">{text}</p>}{action}</div>;
}
export function ErrorBox({ error, retry }: { error: unknown; retry?: () => void }) {
  return (
    <div className="card flex items-start gap-3 border-bad/40 p-4 text-sm" role="alert">
      <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-bad" />
      <div className="flex-1"><p className="font-semibold">Something went wrong</p><p className="text-muted">{(error as Error)?.message || "Unexpected error"}</p></div>
      {retry && <Button variant="ghost" onClick={retry}>Retry</Button>}
    </div>
  );
}
export const Notice = ({ tone = "warn", children }: { tone?: "warn" | "info" | "bad"; children: ReactNode }) => (
  <div className={cx("flex items-start gap-2 rounded-lg border px-3 py-2 text-xs", tone === "warn" ? "border-warn/40 bg-warn/10" : tone === "bad" ? "border-bad/40 bg-bad/10" : "border-brand/40 bg-brand/10")}>
    <AlertTriangle className={cx("mt-0.5 h-3.5 w-3.5 shrink-0", tone === "warn" ? "text-warn" : tone === "bad" ? "text-bad" : "text-brand")} /><div>{children}</div>
  </div>
);

/* ---------- modal / confirm */
export function Modal({ open, onClose, title, children, wide }: { open: boolean; onClose: () => void; title: string; children: ReactNode; wide?: boolean }) {
  useEffect(() => {
    if (!open) return;
    const h = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/60 p-4 pt-16" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div role="dialog" aria-modal="true" aria-label={title} className={cx("card pop w-full", wide ? "max-w-2xl" : "max-w-lg")}>
        <div className="flex items-center justify-between border-b border-line px-5 py-3.5"><h2 className="font-bold">{title}</h2><button aria-label="Close" onClick={onClose}><X className="h-4 w-4 text-muted" /></button></div>
        <div className="p-5">{children}</div>
      </div>
    </div>
  );
}
export function Confirm({ open, title, text, confirmLabel = "Delete", onConfirm, onClose, loading }: { open: boolean; title: string; text: string; confirmLabel?: string; onConfirm: () => void; onClose: () => void; loading?: boolean }) {
  return (
    <Modal open={open} onClose={onClose} title={title}>
      <p className="text-sm text-muted">{text}</p>
      <div className="mt-5 flex justify-end gap-2"><Button variant="ghost" onClick={onClose}>Cancel</Button><Button variant="danger" onClick={onConfirm} loading={loading}>{confirmLabel}</Button></div>
    </Modal>
  );
}
export const Stat = ({ label, value, sub }: { label: string; value: ReactNode; sub?: string }) => (
  <div className="card p-4"><p className="text-xs font-semibold text-muted">{label}</p><p className="mt-1 text-3xl font-extrabold tabular-nums">{value}</p>{sub && <p className="mt-1 text-xs text-muted">{sub}</p>}</div>
);
export function Q<T>({ q, children, skeleton }: { q: { isLoading: boolean; error: unknown; data?: T; refetch: () => void }; children: (d: T) => ReactNode; skeleton?: ReactNode }) {
  if (q.isLoading) return <>{skeleton ?? <PageSkeleton />}</>;
  if (q.error) return <ErrorBox error={q.error} retry={() => q.refetch()} />;
  return <>{children(q.data as T)}</>;
}
