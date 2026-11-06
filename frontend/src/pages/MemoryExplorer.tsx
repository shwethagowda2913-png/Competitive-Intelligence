import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { RefreshCw, Search } from "lucide-react";
import { api, fdt, qs } from "../lib/api";
import { Badge, Button, Card, CardHead, Empty, Field, Input, Notice, PageHeader, Q, Select, Textarea, useToast } from "../components/ui";

export default function MemoryExplorer() {
  const qc = useQueryClient(), toast = useToast();
  const [f, setF] = useState({ op_type: "", status: "", page: 1 });
  const [open, setOpen] = useState<number | null>(null), [query, setQuery] = useState(""), [res, setRes] = useState<any>(null);
  const q = useQuery({ queryKey: ["ops", f], queryFn: () => api.get(`/memory/operations${qs({ ...f, page_size: 25 })}`), refetchInterval: 15000 });
  const sync = useMutation({ mutationFn: () => api.post("/memory/sync"), onSuccess: (r) => { qc.invalidateQueries(); toast(r.failed ? "err" : "ok", `Retain sync: ${r.succeeded} succeeded, ${r.failed} failed, ${r.skipped_unconfigured} skipped (Hindsight not configured)`); }, onError: (e: Error) => toast("err", e.message) });
  const ask = useMutation({ mutationFn: (kind: "recall" | "reflect") => api.post(`/memory/${kind}`, { query }).then((r) => ({ kind, ...r })), onSuccess: (r) => { setRes(r); qc.invalidateQueries({ queryKey: ["ops"] }); }, onError: (e: Error) => toast("err", e.message) });
  const tone = (s: string) => (s === "success" ? "good" : s === "error" ? "bad" : "warn");
  return (
    <>
      <PageHeader title="Memory explorer" sub="Every retain, recall and reflect call made to Hindsight, with status, timing and payload. Skipped means Hindsight was not configured — nothing was written or read." actions={<Button variant="memory" loading={sync.isPending} onClick={() => sync.mutate()}><RefreshCw className="h-4 w-4" />Retain unsynced records</Button>} />
      <Card className="mb-6"><CardHead title="Query memory directly" sub="Runs a real recall or reflect against the Hindsight bank" />
        <div className="space-y-3 p-5"><Field label="Question"><Textarea rows={2} placeholder="How did we respond the last time a competitor cut prices, and what happened?" value={query} onChange={(e) => setQuery(e.target.value)} /></Field>
          <div className="flex gap-2"><Button disabled={query.length < 3} loading={ask.isPending && ask.variables === "recall"} onClick={() => ask.mutate("recall")}><Search className="h-4 w-4" />Recall</Button><Button variant="memory" disabled={query.length < 3} loading={ask.isPending && ask.variables === "reflect"} onClick={() => ask.mutate("reflect")}>Reflect</Button></div>
          {res && (res.status !== "success" ? <Notice tone={res.status === "error" ? "bad" : "warn"}>{res.error}</Notice> : res.kind === "recall" ? (
            <div className="space-y-2"><p className="text-xs text-muted">{res.data.count} memories</p>{res.data.memories.map((m: any, i: number) => <div key={i} className="rounded-lg bg-raised p-3 text-xs"><span className="font-mono text-memory">{m.document_id || m.id}</span> <Badge>{m.type}</Badge><p className="mt-1">{m.text}</p></div>)}{!res.data.count && <p className="text-sm text-muted">Nothing relevant recalled.</p>}</div>
          ) : <div className="rail pl-4 text-sm"><p className="whitespace-pre-wrap">{res.data.text}</p><p className="mt-2 text-xs text-muted">Based on {res.data.based_on.length} memories</p></div>)}</div></Card>
      <div className="mb-4 flex gap-3"><Select aria-label="Operation" className="max-w-[10rem]" value={f.op_type} onChange={(e) => setF({ ...f, op_type: e.target.value, page: 1 })}><option value="">All operations</option><option value="retain">retain</option><option value="recall">recall</option><option value="reflect">reflect</option></Select>
        <Select aria-label="Status" className="max-w-[10rem]" value={f.status} onChange={(e) => setF({ ...f, status: e.target.value, page: 1 })}><option value="">Any status</option><option value="success">success</option><option value="error">error</option><option value="skipped">skipped</option></Select></div>
      <Q q={q}>{(d) => (
        <Card>{d.items.length === 0 ? <Empty title="No memory operations yet" text="Verify an event, record a decision, or run the guided demo. Each action is logged here." /> : (<>
          <div className="overflow-x-auto"><table className="w-full"><thead className="border-b border-line"><tr><th className="th">When</th><th className="th">Operation</th><th className="th">Status</th><th className="th">Related</th><th className="th">Query / document</th><th className="th">Time</th></tr></thead>
            <tbody className="divide-y divide-line">{d.items.map((o: any) => (<>
              <tr key={o.id} className="cursor-pointer hover:bg-raised/50" onClick={() => setOpen(open === o.id ? null : o.id)}><td className="td whitespace-nowrap text-xs text-muted">{fdt(o.created_at)}</td><td className="td"><Badge tone="memory">{o.op_type}</Badge></td><td className="td"><Badge tone={tone(o.status) as any}>{o.status}</Badge></td><td className="td text-xs">{o.related_type ? `${o.related_type} #${o.related_id}` : "—"}</td><td className="td max-w-md truncate text-xs">{o.query}</td><td className="td text-xs tabular-nums">{o.duration_ms} ms</td></tr>
              {open === o.id && <tr key={`${o.id}x`}><td colSpan={6} className="bg-raised/50 px-4 py-3">{o.error && <Notice tone={o.status === "error" ? "bad" : "warn"}>{o.error}</Notice>}<pre className="mt-2 max-h-72 overflow-auto whitespace-pre-wrap font-mono text-[11px]">{JSON.stringify(o.result, null, 2)}</pre><p className="mt-1 text-[11px] text-muted">bank: {o.bank_id}</p></td></tr>}</>))}</tbody></table></div>
          <div className="flex items-center justify-between border-t border-line px-4 py-3 text-xs text-muted"><span>{d.total} operations</span><div className="flex gap-2"><Button variant="ghost" disabled={f.page <= 1} onClick={() => setF({ ...f, page: f.page - 1 })}>Previous</Button><Button variant="ghost" disabled={f.page * d.page_size >= d.total} onClick={() => setF({ ...f, page: f.page + 1 })}>Next</Button></div></div></>)}</Card>)}</Q>
    </>
  );
}
