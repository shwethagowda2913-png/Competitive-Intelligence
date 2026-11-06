import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, Target, Trash2 } from "lucide-react";
import { api, fdate, nice, pct, STRATEGIES } from "../lib/api";
import { Badge, Button, Card, Confirm, Empty, Field, Input, Modal, Notice, PageHeader, Q, Select, SimBadge, Textarea, useToast, VerdictBadge } from "../components/ui";

const blankD = { event_id: "", title: "", strategy_type: "targeted_discount", decision: "", rationale: "", assumption: "", expected_result: "", expected_acquisition_pct: "", expected_margin_pct: "", decided_on: "" };
const num = (v: string) => (v === "" ? null : Number(v));

export default function Decisions() {
  const qc = useQueryClient(), toast = useToast();
  const [dForm, setDForm] = useState<any>(null), [oForm, setOForm] = useState<any>(null), [del, setDel] = useState<any>(null), [open, setOpen] = useState<number | null>(null);
  const q = useQuery({ queryKey: ["decisions"], queryFn: () => api.get("/decisions?page_size=200") });
  const evs = useQuery({ queryKey: ["events-all"], queryFn: () => api.get("/events?page_size=500") });
  const saveD = useMutation({
    mutationFn: (f: any) => api.post("/decisions", { ...f, event_id: Number(f.event_id), expected_acquisition_pct: num(f.expected_acquisition_pct), expected_margin_pct: num(f.expected_margin_pct), decided_on: f.decided_on || null }),
    onSuccess: () => { qc.invalidateQueries(); toast("ok", "Decision recorded"); setDForm(null); }, onError: (e: Error) => toast("err", e.message) });
  const saveO = useMutation({
    mutationFn: (f: any) => api.post("/outcomes", { decision_id: f.decision_id, actual_result: f.actual_result, acquisition_change_pct: num(f.acq), margin_change_pct: num(f.mar), measurement_days: num(f.days), outcome_status: f.status }),
    onSuccess: () => { qc.invalidateQueries(); toast("ok", "Outcome recorded and audited"); setOForm(null); }, onError: (e: Error) => toast("err", e.message) });
  const rm = useMutation({ mutationFn: (id: number) => api.del(`/decisions/${id}`), onSuccess: () => { qc.invalidateQueries(); toast("ok", "Decision deleted"); setDel(null); }, onError: (e: Error) => toast("err", e.message) });
  const openO = (d: any) => setOForm({ decision_id: d.id, title: d.title, actual_result: d.outcome?.actual_result || "", acq: d.outcome?.acquisition_change_pct ?? "", mar: d.outcome?.margin_change_pct ?? "", days: d.outcome?.measurement_days ?? "", status: d.outcome?.outcome_status || "pending", exp: d });
  return (
    <>
      <PageHeader title="Decisions and outcomes" sub="Link what CloudDesk did to the competitor event, state the assumption, then record what actually happened. Missing results are tracked as pending, never as failure." actions={<Button onClick={() => setDForm({ ...blankD })}><Plus className="h-4 w-4" />Record decision</Button>} />
      <Q q={q}>{(d) => (
        <Card>{d.items.length === 0 ? <Empty title="No decisions recorded" text="Record how CloudDesk responded to a competitor event so the agent can learn from it." action={<Button onClick={() => setDForm({ ...blankD })}>Record decision</Button>} /> : (
          <div className="overflow-x-auto"><table className="w-full"><thead className="border-b border-line"><tr><th className="th">Decision</th><th className="th">Expected</th><th className="th">Actual</th><th className="th">Assumption</th><th className="th" /></tr></thead>
            <tbody className="divide-y divide-line">{d.items.map((x: any) => (
              <tr key={x.id} className="hover:bg-raised/40"><td className="td max-w-xs"><button className="text-left font-bold hover:text-brand" onClick={() => setOpen(open === x.id ? null : x.id)}>{x.title}</button>
                <div className="mt-1 flex flex-wrap gap-1.5"><Badge tone="brand">{nice(x.strategy_type)}</Badge>{x.is_synthetic && <SimBadge />}</div><p className="mt-1 text-xs text-muted">{x.competitor_name} · {nice(x.event_category)} · {fdate(x.decided_on)}</p>
                {open === x.id && <div className="pop mt-3 space-y-2 rounded-lg bg-raised p-3 text-xs"><p><b>Event:</b> {x.event_title}</p><p><b>Action:</b> {x.decision}</p><p><b>Rationale:</b> {x.rationale || "—"}</p><p><b>Expected result:</b> {x.expected_result || "—"}</p>{x.outcome && <p><b>Actual:</b> {x.outcome.actual_result}</p>}<p className="text-muted">{x.audit?.explanation}</p></div>}</td>
                <td className="td text-xs tabular-nums">Acq {pct(x.expected_acquisition_pct)}<br />Margin {pct(x.expected_margin_pct)}</td>
                <td className="td text-xs tabular-nums">{x.outcome && x.outcome.outcome_status !== "pending" ? <>Acq {pct(x.outcome.acquisition_change_pct)}<br />Margin {pct(x.outcome.margin_change_pct)}<br /><span className="text-muted">{x.outcome.measurement_days ?? "?"} days</span></> : <span className="text-muted">Not measured yet</span>}</td>
                <td className="td"><VerdictBadge v={x.audit?.verdict || "pending"} /><p className="mt-1 max-w-[14rem] text-xs text-muted">{x.assumption}</p></td>
                <td className="td"><div className="flex justify-end gap-1"><Button variant="ghost" onClick={() => openO(x)}><Target className="h-4 w-4" />{x.outcome ? "Update" : "Outcome"}</Button><Button variant="ghost" aria-label="Delete decision" onClick={() => setDel(x)}><Trash2 className="h-4 w-4 text-bad" /></Button></div></td></tr>))}</tbody></table></div>)}</Card>)}</Q>
      <Modal wide open={!!dForm} onClose={() => setDForm(null)} title="Record a company decision">
        {dForm && <form className="space-y-3" onSubmit={(e) => { e.preventDefault(); saveD.mutate(dForm); }}>
          <Field label="Responding to competitor event"><Select required value={dForm.event_id} onChange={(e) => setDForm({ ...dForm, event_id: e.target.value })}><option value="">Choose event…</option>{(evs.data?.items || []).map((e: any) => <option key={e.id} value={e.id}>{e.competitor_name}: {e.title}</option>)}</Select></Field>
          <div className="grid gap-3 sm:grid-cols-2"><Field label="Decision title"><Input required minLength={3} value={dForm.title} onChange={(e) => setDForm({ ...dForm, title: e.target.value })} /></Field>
            <Field label="Strategy type"><Select value={dForm.strategy_type} onChange={(e) => setDForm({ ...dForm, strategy_type: e.target.value })}>{STRATEGIES.map((s) => <option key={s} value={s}>{nice(s)}</option>)}</Select></Field></div>
          <Field label="What will we do?"><Textarea required value={dForm.decision} onChange={(e) => setDForm({ ...dForm, decision: e.target.value })} /></Field>
          <Field label="Rationale"><Textarea rows={2} value={dForm.rationale} onChange={(e) => setDForm({ ...dForm, rationale: e.target.value })} /></Field>
          <Field label="Assumption" hint="What must be true for this to work? It will be audited against the outcome."><Textarea rows={2} value={dForm.assumption} onChange={(e) => setDForm({ ...dForm, assumption: e.target.value })} /></Field>
          <Field label="Expected result"><Input value={dForm.expected_result} onChange={(e) => setDForm({ ...dForm, expected_result: e.target.value })} /></Field>
          <div className="grid gap-3 sm:grid-cols-3"><Field label="Expected acquisition change (%)"><Input type="number" step="0.1" value={dForm.expected_acquisition_pct} onChange={(e) => setDForm({ ...dForm, expected_acquisition_pct: e.target.value })} /></Field>
            <Field label="Lowest acceptable margin change (%)"><Input type="number" step="0.1" value={dForm.expected_margin_pct} onChange={(e) => setDForm({ ...dForm, expected_margin_pct: e.target.value })} /></Field>
            <Field label="Decision date"><Input type="date" value={dForm.decided_on} onChange={(e) => setDForm({ ...dForm, decided_on: e.target.value })} /></Field></div>
          <div className="flex justify-end gap-2 pt-2"><Button type="button" variant="ghost" onClick={() => setDForm(null)}>Cancel</Button><Button type="submit" loading={saveD.isPending}>Record decision</Button></div></form>}
      </Modal>
      <Modal wide open={!!oForm} onClose={() => setOForm(null)} title="Record measured outcome">
        {oForm && <form className="space-y-3" onSubmit={(e) => { e.preventDefault(); saveO.mutate(oForm); }}>
          <p className="text-sm font-semibold">{oForm.title}</p>
          <Notice tone="info">Expected: acquisition {pct(oForm.exp.expected_acquisition_pct)}, margin no worse than {pct(oForm.exp.expected_margin_pct)}. Leave metrics blank if not yet measured.</Notice>
          <Field label="What happened?"><Textarea value={oForm.actual_result} onChange={(e) => setOForm({ ...oForm, actual_result: e.target.value })} /></Field>
          <div className="grid gap-3 sm:grid-cols-4"><Field label="Acquisition change (%)"><Input type="number" step="0.1" value={oForm.acq} onChange={(e) => setOForm({ ...oForm, acq: e.target.value })} /></Field>
            <Field label="Margin change (pts)"><Input type="number" step="0.1" value={oForm.mar} onChange={(e) => setOForm({ ...oForm, mar: e.target.value })} /></Field>
            <Field label="Measured over (days)"><Input type="number" min={0} value={oForm.days} onChange={(e) => setOForm({ ...oForm, days: e.target.value })} /></Field>
            <Field label="Outcome status"><Select value={oForm.status} onChange={(e) => setOForm({ ...oForm, status: e.target.value })}><option value="pending">pending</option><option value="success">success</option><option value="mixed">mixed</option><option value="failure">failure</option></Select></Field></div>
          <div className="flex justify-end gap-2 pt-2"><Button type="button" variant="ghost" onClick={() => setOForm(null)}>Cancel</Button><Button type="submit" loading={saveO.isPending}>Save outcome</Button></div></form>}
      </Modal>
      <Confirm open={!!del} title="Delete this decision?" text="The decision and its outcome are removed from the database. Memory already retained in Hindsight is not deleted." onConfirm={() => rm.mutate(del.id)} onClose={() => setDel(null)} loading={rm.isPending} />
    </>
  );
}
