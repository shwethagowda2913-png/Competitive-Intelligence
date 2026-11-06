import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { api, CATEGORIES, fdate, nice, qs } from "../lib/api";
import { CAT_COLORS } from "../lib/charts";
import EventDetail from "../components/EventDetail";
import { Badge, Card, Empty, Input, PageHeader, Q, Select, SimBadge, VerifBadge } from "../components/ui";

export default function Timeline() {
  const [f, setF] = useState({ q: "", competitor_id: "", category: "", verification: "", date_from: "", date_to: "" });
  const [open, setOpen] = useState<number | null>(null);
  const comps = useQuery({ queryKey: ["competitors-all"], queryFn: () => api.get("/competitors?page_size=200") });
  const q = useQuery({ queryKey: ["timeline", f], queryFn: () => api.get(`/events${qs({ ...f, page_size: 500 })}`) });
  const groups = useMemo(() => {
    const m = new Map<string, any[]>();
    (q.data?.items || []).forEach((e: any) => { const k = e.event_date ? e.event_date.slice(0, 7) : "undated"; m.set(k, [...(m.get(k) || []), e]); });
    return [...m.entries()];
  }, [q.data]);
  return (
    <>
      <PageHeader title="Competitive timeline" sub="Every recorded competitor move in date order. Select an event for sources, facts and verification." />
      <div className="mb-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-6">
        <div className="lg:col-span-2"><Input aria-label="Search" placeholder="Search timeline" value={f.q} onChange={(e) => setF({ ...f, q: e.target.value })} /></div>
        <Select aria-label="Competitor" value={f.competitor_id} onChange={(e) => setF({ ...f, competitor_id: e.target.value })}><option value="">All competitors</option>{(comps.data?.items || []).map((c: any) => <option key={c.id} value={c.id}>{c.name}</option>)}</Select>
        <Select aria-label="Category" value={f.category} onChange={(e) => setF({ ...f, category: e.target.value })}><option value="">All categories</option>{CATEGORIES.map((c) => <option key={c} value={c}>{nice(c)}</option>)}</Select>
        <Input aria-label="From date" type="date" value={f.date_from} onChange={(e) => setF({ ...f, date_from: e.target.value })} />
        <Input aria-label="To date" type="date" value={f.date_to} onChange={(e) => setF({ ...f, date_to: e.target.value })} />
      </div>
      <Q q={q}>{() => groups.length === 0 ? <Card><Empty title="No events in this range" text="Adjust the filters or add events in Event intelligence." /></Card> : (
        <div className="space-y-8">{groups.map(([month, evs]) => (
          <div key={month}><h2 className="mb-3 text-sm font-bold text-muted">{month === "undated" ? "Undated" : new Date(month + "-01").toLocaleDateString(undefined, { month: "long", year: "numeric" })}</h2>
            <ol className="relative ml-2 space-y-3 border-l border-line pl-6">{evs.map((e: any) => (
              <li key={e.id} className="relative"><span className="absolute -left-[31px] top-4 h-3 w-3 rounded-full border-2 border-bg" style={{ background: CAT_COLORS[e.category] }} />
                <button onClick={() => setOpen(e.id)} className="card w-full p-4 text-left transition hover:border-brand/60">
                  <div className="flex flex-wrap items-center justify-between gap-2"><p className={`text-sm font-bold ${e.superseded_by_id ? "line-through opacity-60" : ""}`}>{e.title}</p><span className="text-xs text-muted">{fdate(e.event_date)}</span></div>
                  <p className="mt-1 text-xs text-muted">{e.competitor_name}</p><div className="mt-2 flex flex-wrap gap-1.5"><Badge>{nice(e.category)}</Badge><VerifBadge s={e.verification_status} />{e.superseded_by_id && <Badge tone="warn">superseded</Badge>}{e.is_synthetic && <SimBadge />}{e.sources[0] && <Badge tone="neutral">{e.sources[0].name || "source"}</Badge>}</div>
                </button></li>))}</ol></div>))}</div>)}</Q>
      <EventDetail id={open} onClose={() => setOpen(null)} />
    </>
  );
}
