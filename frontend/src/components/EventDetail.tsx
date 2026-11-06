import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { Brain, ExternalLink } from "lucide-react";
import { api, fdate, fdt, nice } from "../lib/api";
import { Badge, Button, CatBadge, Modal, Notice, Select, SimBadge, useToast, VerifBadge } from "./ui";

export default function EventDetail({ id, onClose }: { id: number | null; onClose: () => void }) {
  const qc = useQueryClient(), toast = useToast();
  const q = useQuery({ queryKey: ["event", id], queryFn: () => api.get(`/events/${id}`), enabled: id !== null });
  const all = useQuery({ queryKey: ["events-all-for-supersede"], queryFn: () => api.get("/events?page_size=500"), enabled: id !== null });
  const patch = useMutation({ mutationFn: (b: any) => api.patch(`/events/${id}`, b), onSuccess: () => { qc.invalidateQueries(); toast("ok", "Event updated"); }, onError: (e: Error) => toast("err", e.message) });
  const e = q.data;
  return (
    <Modal open={id !== null} onClose={onClose} title="Event detail" wide>
      {!e ? <p className="text-sm text-muted">Loading…</p> : (
        <div className="space-y-4 text-sm">
          <div><div className="mb-2 flex flex-wrap gap-1.5"><CatBadge c={e.category} /><VerifBadge s={e.verification_status} />{e.is_synthetic && <SimBadge />}<Badge tone="neutral">analysis: {e.analysis_mode}</Badge>{e.retained && <Badge tone="memory">retained in Hindsight</Badge>}</div>
            <h3 className="text-lg font-extrabold">{e.title}</h3><p className="text-xs text-muted">{e.competitor_name} · {fdate(e.event_date)} · collected {fdt(e.collected_at)}</p></div>
          {e.superseded_by_id && <Notice>This event was superseded by event #{e.superseded_by_id}. It is excluded from signals and recommendations.</Notice>}
          <p className="whitespace-pre-wrap">{e.description || "No description."}</p>
          {e.facts.length > 0 && <div><p className="label">Extracted facts</p><ul className="list-disc space-y-1 pl-5">{e.facts.map((f: string, i: number) => <li key={i}>{f}</li>)}</ul></div>}
          {e.implications.length > 0 && <div><p className="label">Possible implications (hypotheses)</p><ul className="list-disc space-y-1 pl-5">{e.implications.map((f: string, i: number) => <li key={i}>{f}</li>)}</ul></div>}
          {e.uncertainty && <div><p className="label">Uncertainty</p><p className="text-muted">{e.uncertainty}</p></div>}
          <div><p className="label">Sources</p>{e.sources.length ? e.sources.map((s: any) => <p key={s.id}>{s.url ? <a className="inline-flex items-center gap-1 text-brand" href={s.url} target="_blank" rel="noreferrer noopener">{s.name || s.url}<ExternalLink className="h-3 w-3" /></a> : s.name}</p>) : <p className="text-muted">No source recorded — verification is limited.</p>}</div>
          {e.themes.length > 0 && <div className="flex flex-wrap gap-1.5">{e.themes.map((t: string) => <Badge key={t}>{nice(t)}</Badge>)}</div>}
          <div className="grid gap-3 border-t border-line pt-4 sm:grid-cols-2">
            <div><p className="label">Verification status</p><Select value={e.verification_status} onChange={(ev) => patch.mutate({ verification_status: ev.target.value })}><option value="unverified">unverified</option><option value="verified">verified (retains to Hindsight)</option><option value="disputed">disputed</option></Select></div>
            <div><p className="label">Superseded by</p><Select value={e.superseded_by_id ?? ""} onChange={(ev) => patch.mutate({ superseded_by_id: ev.target.value ? Number(ev.target.value) : null })}><option value="">Not superseded</option>
              {(all.data?.items || []).filter((x: any) => x.competitor_id === e.competitor_id && x.id !== e.id).map((x: any) => <option key={x.id} value={x.id}>#{x.id} {x.title.slice(0, 50)}</option>)}</Select></div>
          </div>
          <div className="flex justify-end"><Link to={`/advisor?event=${e.id}`}><Button variant="memory"><Brain className="h-4 w-4" />Ask the strategic advisor</Button></Link></div>
        </div>)}
    </Modal>
  );
}
