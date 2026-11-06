import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, Rss, Sparkles } from "lucide-react";
import { api, CATEGORIES, fdate, nice, qs } from "../lib/api";
import EventDetail from "../components/EventDetail";
import { Badge, Button, Card, CardHead, CatBadge, Empty, Field, Input, Modal, Notice, PageHeader, Q, Select, SimBadge, Textarea, useToast, VerifBadge } from "../components/ui";

const blank = { competitor_id: "", category: "other", title: "", description: "", event_date: "", verification_status: "unverified", source_name: "", source_url: "", facts: "", implications: "", uncertainty: "", analysis_mode: "manual" };

export default function Events() {
  const qc = useQueryClient(), toast = useToast();
  const [f, setF] = useState({ q: "", competitor_id: "", category: "", verification: "", page: 1 });
  const [form, setForm] = useState<any>(null), [open, setOpen] = useState<number | null>(null), [notes, setNotes] = useState<string[]>([]);
  const [ax, setAx] = useState({ competitor_id: "", text: "", url: "" });
  const comps = useQuery({ queryKey: ["competitors-all"], queryFn: () => api.get("/competitors?page_size=200") });
  const q = useQuery({ queryKey: ["events", f], queryFn: () => api.get(`/events${qs({ ...f, page_size: 25 })}`) });
  const analyze = useMutation({
    mutationFn: () => api.post("/events/analyze", { competitor_id: ax.competitor_id ? Number(ax.competitor_id) : null, text: ax.text || null, url: ax.url || null }),
    onSuccess: (r) => { setNotes(r.notes); setForm({ ...blank, competitor_id: r.competitor_id ?? ax.competitor_id, category: r.category, title: r.title, description: r.description, event_date: r.event_date || "", verification_status: r.verification_status, source_name: r.source_name, source_url: r.source_url || "", facts: r.facts.join("\n"), implications: r.implications.join("\n"), uncertainty: r.uncertainty, analysis_mode: r.analysis_mode }); },
    onError: (e: Error) => toast("err", e.message),
  });
  const [rss, setRss] = useState<any>({ competitor_id: "", url: "", items: null, picked: {} });
  const rssPrev = useMutation({
    mutationFn: () => api.post("/events/rss-preview", { competitor_id: Number(rss.competitor_id), url: rss.url, limit: 15 }),
    onSuccess: (r) => setRss({ ...rss, items: r.items, picked: Object.fromEntries(r.items.map((x: any, i: number) => [i, !x.duplicate])) }),
    onError: (e: Error) => toast("err", e.message),
  });
  const rssImport = useMutation({
    mutationFn: async () => {
      let ok = 0, dup = 0;
      for (const [i, x] of (rss.items || []).entries()) {
        if (!rss.picked[i]) continue;
        try { await api.post("/events", { competitor_id: x.competitor_id, category: x.category, title: x.title, description: x.description, event_date: x.event_date, verification_status: "unverified", source: { name: x.source_name, url: x.source_url }, facts: x.facts, uncertainty: "Imported from RSS with rule-based classification; review before relying on it.", analysis_mode: "heuristic" }); ok++; }
        catch (e: any) { if (e.status === 409) dup++; else throw e; }
      }
      return { ok, dup };
    },
    onSuccess: (r) => { qc.invalidateQueries(); toast("ok", `Imported ${r.ok} event(s)${r.dup ? `, skipped ${r.dup} duplicate(s)` : ""}`); setRss({ competitor_id: rss.competitor_id, url: "", items: null, picked: {} }); },
    onError: (e: Error) => toast("err", e.message),
  });
  const save = useMutation({
    mutationFn: (x: any) => api.post("/events", { competitor_id: Number(x.competitor_id), category: x.category, title: x.title, description: x.description, event_date: x.event_date || null, verification_status: x.verification_status,
      source: x.source_name || x.source_url ? { name: x.source_name, url: x.source_url || null } : null, facts: x.facts.split("\n").map((s: string) => s.trim()).filter(Boolean), implications: x.implications.split("\n").map((s: string) => s.trim()).filter(Boolean), uncertainty: x.uncertainty, analysis_mode: x.analysis_mode }),
    onSuccess: () => { qc.invalidateQueries(); toast("ok", "Event saved"); setForm(null); setAx({ competitor_id: "", text: "", url: "" }); setNotes([]); },
    onError: (e: any) => toast("err", e.status === 409 ? "That event already exists (duplicate detected)." : e.message),
  });
  return (
    <>
      <PageHeader title="Event intelligence" sub="Paste an article or URL for structured extraction, or add an event by hand. Nothing is invented: missing fields stay empty." actions={<Button onClick={() => setForm({ ...blank })}><Plus className="h-4 w-4" />Add event manually</Button>} />
      <Card className="mb-6"><CardHead title="Analyse new competitor information" sub="URLs are fetched server-side with SSRF protection, a timeout and a size limit." />
        <div className="grid gap-3 p-5 md:grid-cols-3">
          <Field label="Competitor (optional)"><Select value={ax.competitor_id} onChange={(e) => setAx({ ...ax, competitor_id: e.target.value })}><option value="">Detect from text</option>{(comps.data?.items || []).map((c: any) => <option key={c.id} value={c.id}>{c.name}</option>)}</Select></Field>
          <div className="md:col-span-2"><Field label="Source URL (optional)"><Input type="url" placeholder="https://competitor.com/blog/announcement" value={ax.url} onChange={(e) => setAx({ ...ax, url: e.target.value })} /></Field></div>
          <div className="md:col-span-3"><Field label="Text to analyse"><Textarea rows={4} placeholder="Paste a press release, changelog entry, job post or news item…" value={ax.text} onChange={(e) => setAx({ ...ax, text: e.target.value })} /></Field></div>
          <div className="md:col-span-3 flex justify-end"><Button variant="memory" disabled={!ax.text && !ax.url} loading={analyze.isPending} onClick={() => analyze.mutate()}><Sparkles className="h-4 w-4" />Analyse and review</Button></div>
        </div></Card>
      <Card className="mb-6"><CardHead title="Import from an RSS or Atom feed" sub="Entries are classified with keyword rules and imported as unverified — verify them before they are retained in Hindsight." />
        <div className="space-y-3 p-5"><div className="grid gap-3 md:grid-cols-3">
          <Field label="Competitor"><Select value={rss.competitor_id} onChange={(e) => setRss({ ...rss, competitor_id: e.target.value, items: null })}><option value="">Choose…</option>{(comps.data?.items || []).map((c: any) => <option key={c.id} value={c.id}>{c.name}</option>)}</Select></Field>
          <div className="md:col-span-2"><Field label="Feed URL"><Input type="url" placeholder="https://competitor.com/blog/feed.xml" value={rss.url} onChange={(e) => setRss({ ...rss, url: e.target.value, items: null })} /></Field></div></div>
          <div className="flex justify-end"><Button variant="ghost" disabled={!rss.competitor_id || !rss.url} loading={rssPrev.isPending} onClick={() => rssPrev.mutate()}><Rss className="h-4 w-4" />Preview feed</Button></div>
          {rss.items && <div className="pop space-y-2">{rss.items.map((x: any, i: number) => (
            <label key={i} className="flex cursor-pointer items-start gap-3 rounded-lg border border-line bg-raised/50 p-3 text-sm"><input type="checkbox" className="mt-1" checked={!!rss.picked[i]} onChange={(e) => setRss({ ...rss, picked: { ...rss.picked, [i]: e.target.checked } })} />
              <span className="flex-1"><span className="font-semibold">{x.title}</span><span className="mt-0.5 block text-xs text-muted">{fdate(x.event_date)} · {nice(x.category)}{x.duplicate ? " · already imported" : ""}</span></span></label>))}
            <div className="flex justify-end"><Button variant="memory" loading={rssImport.isPending} onClick={() => rssImport.mutate()}>Import selected</Button></div></div>}</div></Card>
      <div className="mb-4 flex flex-wrap gap-3">
        <Input aria-label="Search events" placeholder="Search events" className="max-w-xs" value={f.q} onChange={(e) => setF({ ...f, q: e.target.value, page: 1 })} />
        <Select aria-label="Competitor" className="max-w-[10rem]" value={f.competitor_id} onChange={(e) => setF({ ...f, competitor_id: e.target.value, page: 1 })}><option value="">All competitors</option>{(comps.data?.items || []).map((c: any) => <option key={c.id} value={c.id}>{c.name}</option>)}</Select>
        <Select aria-label="Category" className="max-w-[11rem]" value={f.category} onChange={(e) => setF({ ...f, category: e.target.value, page: 1 })}><option value="">All categories</option>{CATEGORIES.map((c) => <option key={c} value={c}>{nice(c)}</option>)}</Select>
        <Select aria-label="Verification" className="max-w-[10rem]" value={f.verification} onChange={(e) => setF({ ...f, verification: e.target.value, page: 1 })}><option value="">Any verification</option><option value="verified">verified</option><option value="unverified">unverified</option><option value="disputed">disputed</option></Select>
      </div>
      <Q q={q}>{(d) => (
        <Card>{d.items.length === 0 ? <Empty title="No events match these filters" /> : (<>
          <div className="overflow-x-auto"><table className="w-full"><thead className="border-b border-line"><tr><th className="th">Event</th><th className="th">Date</th><th className="th">Category</th><th className="th">Status</th></tr></thead>
            <tbody className="divide-y divide-line">{d.items.map((e: any) => (
              <tr key={e.id} className="cursor-pointer hover:bg-raised/50" onClick={() => setOpen(e.id)}><td className="td"><button className={`text-left font-semibold hover:text-brand ${e.superseded_by_id ? "line-through opacity-60" : ""}`}>{e.title}</button><p className="text-xs text-muted">{e.competitor_name}</p></td>
                <td className="td whitespace-nowrap text-muted">{fdate(e.event_date)}</td><td className="td"><CatBadge c={e.category} /></td>
                <td className="td"><div className="flex flex-wrap gap-1.5"><VerifBadge s={e.verification_status} />{e.retained && <Badge tone="memory">in memory</Badge>}{e.is_synthetic && <SimBadge />}</div></td></tr>))}</tbody></table></div>
          <div className="flex items-center justify-between border-t border-line px-4 py-3 text-xs text-muted"><span>{d.total} events</span><div className="flex gap-2"><Button variant="ghost" disabled={f.page <= 1} onClick={() => setF({ ...f, page: f.page - 1 })}>Previous</Button><Button variant="ghost" disabled={f.page * d.page_size >= d.total} onClick={() => setF({ ...f, page: f.page + 1 })}>Next</Button></div></div></>)}</Card>)}</Q>
      <EventDetail id={open} onClose={() => setOpen(null)} />
      <Modal wide open={!!form} onClose={() => setForm(null)} title="Review and save event">
        {form && <form className="space-y-3" onSubmit={(e) => { e.preventDefault(); save.mutate(form); }}>
          {form.analysis_mode !== "manual" && <Badge tone={form.analysis_mode === "llm" ? "memory" : "warn"}>Extracted by {form.analysis_mode === "llm" ? "LLM" : "rule-based heuristics"} — review before saving</Badge>}
          {notes.map((n, i) => <Notice key={i} tone="info">{n}</Notice>)}
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Competitor"><Select required value={form.competitor_id} onChange={(e) => setForm({ ...form, competitor_id: e.target.value })}><option value="">Choose…</option>{(comps.data?.items || []).map((c: any) => <option key={c.id} value={c.id}>{c.name}</option>)}</Select></Field>
            <Field label="Category"><Select value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}>{CATEGORIES.map((c) => <option key={c} value={c}>{nice(c)}</option>)}</Select></Field>
            <div className="sm:col-span-2"><Field label="Title"><Input required minLength={3} value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} /></Field></div>
            <Field label="Event date"><Input type="date" value={form.event_date} onChange={(e) => setForm({ ...form, event_date: e.target.value })} /></Field>
            <Field label="Verification" hint="Only verified events are retained in Hindsight."><Select value={form.verification_status} onChange={(e) => setForm({ ...form, verification_status: e.target.value })}><option value="unverified">unverified</option><option value="verified">verified</option><option value="disputed">disputed</option></Select></Field>
            <Field label="Source name"><Input value={form.source_name} onChange={(e) => setForm({ ...form, source_name: e.target.value })} /></Field>
            <Field label="Source URL"><Input type="url" value={form.source_url} onChange={(e) => setForm({ ...form, source_url: e.target.value })} /></Field>
          </div>
          <Field label="Description"><Textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></Field>
          <Field label="Facts (one per line)"><Textarea value={form.facts} onChange={(e) => setForm({ ...form, facts: e.target.value })} /></Field>
          <Field label="Possible implications (one per line, hypotheses)"><Textarea value={form.implications} onChange={(e) => setForm({ ...form, implications: e.target.value })} /></Field>
          <Field label="Uncertainty"><Textarea rows={2} value={form.uncertainty} onChange={(e) => setForm({ ...form, uncertainty: e.target.value })} /></Field>
          <div className="flex justify-end gap-2 pt-2"><Button type="button" variant="ghost" onClick={() => setForm(null)}>Cancel</Button><Button type="submit" loading={save.isPending}>Save event</Button></div></form>}
      </Modal>
    </>
  );
}
