import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useParams } from "react-router-dom";
import { ExternalLink, Pencil, Plus, Trash2 } from "lucide-react";
import { api, fdate, qs } from "../lib/api";
import { Button, Card, CardHead, CatBadge, Confirm, Empty, Field, Input, Modal, PageHeader, Q, SimBadge, Textarea, useToast, VerifBadge } from "../components/ui";

const blank = { name: "", industry: "", website: "", description: "" };

export default function Competitors() {
  const [search, setSearch] = useState(""), [industry, setIndustry] = useState("");
  const [form, setForm] = useState<any>(null), [del, setDel] = useState<any>(null);
  const qc = useQueryClient(), toast = useToast();
  const q = useQuery({ queryKey: ["competitors", search, industry], queryFn: () => api.get(`/competitors${qs({ q: search, industry })}`) });
  const save = useMutation({
    mutationFn: (f: any) => (f.id ? api.put(`/competitors/${f.id}`, f) : api.post("/competitors", f)),
    onSuccess: () => { qc.invalidateQueries(); toast("ok", "Competitor saved"); setForm(null); }, onError: (e: Error) => toast("err", e.message),
  });
  const rm = useMutation({ mutationFn: (id: number) => api.del(`/competitors/${id}`), onSuccess: () => { qc.invalidateQueries(); toast("ok", "Competitor deleted"); setDel(null); }, onError: (e: Error) => toast("err", e.message) });
  return (
    <>
      <PageHeader title="Competitors" sub="Companies you monitor. Each competitor owns its event history." actions={<Button onClick={() => setForm({ ...blank })}><Plus className="h-4 w-4" />Add competitor</Button>} />
      <div className="mb-4 flex flex-wrap gap-3">
        <Input aria-label="Search competitors" placeholder="Search name or description" value={search} onChange={(e) => setSearch(e.target.value)} className="max-w-xs" />
        <Input aria-label="Filter by industry" placeholder="Filter by industry" value={industry} onChange={(e) => setIndustry(e.target.value)} className="max-w-xs" />
      </div>
      <Q q={q}>{(d) => (
        <Card>{d.items.length === 0 ? <Empty title="No competitors match" text="Add your first competitor to start collecting intelligence." action={<Button onClick={() => setForm({ ...blank })}>Add competitor</Button>} /> : (
          <div className="overflow-x-auto"><table className="w-full"><thead className="border-b border-line"><tr><th className="th">Competitor</th><th className="th">Industry</th><th className="th">Website</th><th className="th">Events</th><th className="th" /></tr></thead>
            <tbody className="divide-y divide-line">{d.items.map((c: any) => (
              <tr key={c.id} className="hover:bg-raised/50"><td className="td"><Link to={`/competitors/${c.id}`} className="font-bold text-brand">{c.name}</Link> {c.is_synthetic && <SimBadge />}<p className="mt-0.5 max-w-sm text-xs text-muted">{c.description}</p></td>
                <td className="td text-muted">{c.industry || "—"}</td><td className="td">{c.website ? <a className="inline-flex items-center gap-1 text-brand" href={c.website} target="_blank" rel="noreferrer noopener">{c.website.replace(/^https?:\/\//, "")}<ExternalLink className="h-3 w-3" /></a> : "—"}</td>
                <td className="td tabular-nums">{c.event_count}</td>
                <td className="td"><div className="flex justify-end gap-1"><Button variant="ghost" aria-label={`Edit ${c.name}`} onClick={() => setForm(c)}><Pencil className="h-4 w-4" /></Button><Button variant="ghost" aria-label={`Delete ${c.name}`} onClick={() => setDel(c)}><Trash2 className="h-4 w-4 text-bad" /></Button></div></td></tr>))}</tbody></table></div>)}</Card>)}</Q>
      <Modal open={!!form} onClose={() => setForm(null)} title={form?.id ? "Edit competitor" : "Add competitor"}>
        {form && <form className="space-y-3" onSubmit={(e) => { e.preventDefault(); save.mutate(form); }}>
          <Field label="Name"><Input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></Field>
          <Field label="Industry"><Input value={form.industry} onChange={(e) => setForm({ ...form, industry: e.target.value })} /></Field>
          <Field label="Website"><Input type="url" placeholder="https://" value={form.website} onChange={(e) => setForm({ ...form, website: e.target.value })} /></Field>
          <Field label="Description"><Textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></Field>
          <div className="flex justify-end gap-2 pt-2"><Button type="button" variant="ghost" onClick={() => setForm(null)}>Cancel</Button><Button type="submit" loading={save.isPending}>Save competitor</Button></div></form>}
      </Modal>
      <Confirm open={!!del} title={`Delete ${del?.name}?`} text={`This permanently deletes ${del?.name} and its ${del?.event_count} events, and any decisions linked to them. Memory already retained in Hindsight is not removed.`} onConfirm={() => rm.mutate(del.id)} onClose={() => setDel(null)} loading={rm.isPending} />
    </>
  );
}

export function CompetitorDetail() {
  const { id } = useParams();
  const q = useQuery({ queryKey: ["competitor", id], queryFn: () => api.get(`/competitors/${id}`) });
  const sig = useQuery({ queryKey: ["signals"], queryFn: () => api.get("/strategy-signals") });
  return (
    <Q q={q}>{(c) => (
      <>
        <PageHeader title={c.name} sub={c.description || "No description"} actions={<Link to="/competitors"><Button variant="ghost">All competitors</Button></Link>} />
        <div className="grid gap-6 lg:grid-cols-3">
          <Card className="lg:col-span-1"><CardHead title="Profile" /><dl className="space-y-3 p-5 text-sm">
            <div><dt className="text-xs text-muted">Industry</dt><dd>{c.industry || "—"}</dd></div>
            <div><dt className="text-xs text-muted">Website</dt><dd>{c.website ? <a className="text-brand" href={c.website} target="_blank" rel="noreferrer noopener">{c.website}</a> : "—"}</dd></div>
            <div><dt className="text-xs text-muted">Events recorded</dt><dd>{c.events.length}</dd></div>{c.is_synthetic && <SimBadge />}</dl></Card>
          <Card className="lg:col-span-2"><CardHead title="Strategy hypotheses for this competitor" sub="Inferred, not confirmed" />
            <div className="divide-y divide-line">{(sig.data?.items || []).filter((s: any) => s.competitor_id === c.id).map((s: any, i: number) => (
              <div key={i} className="px-5 py-3"><p className="text-sm font-semibold">{s.hypothesis}</p><p className="text-xs text-muted">{s.reasoning}</p></div>))}
              {!(sig.data?.items || []).some((s: any) => s.competitor_id === c.id) && <Empty title="No clusters detected" text="Need three or more related events across at least two categories." />}</div></Card>
        </div>
        <Card className="mt-6"><CardHead title="Events" /><div className="divide-y divide-line">{c.events.length === 0 && <Empty title="No events yet" text="Add events from Event intelligence." />}
          {c.events.map((e: any) => (<Link to={`/advisor?event=${e.id}`} key={e.id} className="flex flex-wrap items-center justify-between gap-2 px-5 py-3 hover:bg-raised/50">
            <div className="min-w-0"><p className={`truncate text-sm font-semibold ${e.superseded_by_id ? "line-through opacity-60" : ""}`}>{e.title}</p><p className="text-xs text-muted">{fdate(e.event_date)}</p></div>
            <div className="flex gap-1.5"><CatBadge c={e.category} /><VerifBadge s={e.verification_status} />{e.is_synthetic && <SimBadge />}</div></Link>))}</div></Card>
      </>)}</Q>
  );
}
