import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useSearchParams } from "react-router-dom";
import { Brain, CheckCircle2, Circle, Play } from "lucide-react";
import { api } from "../lib/api";
import RecommendationView from "../components/RecommendationView";
import { Badge, Button, Card, CardHead, Field, PageHeader, Select, SimBadge, useToast } from "../components/ui";

const STEPS = [
  { n: 1, title: "A competitor cuts its price", text: "RivalOne drops its Pro plan price by 20%. The advisor has no pricing history yet, so it must stay cautious.", key: "step1_event" },
  { n: 2, title: "CloudDesk records a discount decision", text: "A broad 15% discount, with the assumption that acquisition rises ≥12% and margin falls ≤2 points.", key: "step2_decision" },
  { n: 3, title: "The measured result arrives", text: "Acquisition +8%, margin −5 points after 60 days. The assumption is audited and the lesson is retained.", key: "step3_outcome" },
  { n: 4, title: "A similar event happens", text: "NovaSuite launches a cheaper Starter plan. Watch memory change the recommendation.", key: "step4_event" },
];

export default function Advisor() {
  const [sp, setSp] = useSearchParams();
  const qc = useQueryClient(), toast = useToast();
  const [eventId, setEventId] = useState<string>(sp.get("event") || "");
  const [rec, setRec] = useState<any>(null);
  const evs = useQuery({ queryKey: ["events-all"], queryFn: () => api.get("/events?page_size=500") });
  const st = useQuery({ queryKey: ["demo-status"], queryFn: () => api.get("/demo/status") });
  const run = useMutation({ mutationFn: () => api.post("/recommendations", { event_id: Number(eventId) }), onSuccess: (r) => { setRec(r); qc.invalidateQueries(); }, onError: (e: Error) => toast("err", e.message) });
  const step = useMutation({
    mutationFn: (n: number) => api.post(`/demo/steps/${n}`),
    onSuccess: (r, n) => { qc.invalidateQueries(); if (r.recommendation) { setRec(r.recommendation); setEventId(String(r.event_id)); } toast("ok", `Demo step ${n} complete`); },
    onError: (e: Error) => toast("err", e.message),
  });
  useEffect(() => { if (eventId) setSp({ event: eventId }, { replace: true }); }, [eventId]);
  const s = st.data || {};
  const done = (k: string) => !!s[k];
  return (
    <>
      <PageHeader title="Strategic AI advisor" sub="Validates the event, recalls CloudDesk's history from the database and Hindsight, reflects on it, then recommends — with evidence, alternatives and uncertainty." />
      <Card className="mb-6">
        <CardHead title="Guided demo: watch the agent learn" sub="Four steps with simulated data, using the same services as the rest of the app. Every Hindsight call is real and logged." right={<SimBadge />} />
        <div className="grid gap-px bg-line md:grid-cols-4">{STEPS.map((x) => (
          <div key={x.n} className="flex flex-col gap-2 bg-surface p-4">
            <div className="flex items-center gap-2 text-sm font-bold">{done(x.key) ? <CheckCircle2 className="h-4 w-4 text-good" /> : <Circle className="h-4 w-4 text-muted" />}{x.title}</div>
            <p className="flex-1 text-xs text-muted">{x.text}</p>
            <Button variant={done(x.key) ? "ghost" : "memory"} loading={step.isPending && step.variables === x.n} onClick={() => step.mutate(x.n)}><Play className="h-3.5 w-3.5" />{done(x.key) && x.n !== 1 && x.n !== 4 ? "Re-run" : done(x.key) ? "Show recommendation" : "Run step " + x.n}</Button>
          </div>))}</div>
      </Card>
      <Card className="mb-6"><div className="flex flex-wrap items-end gap-3 p-5">
        <div className="min-w-[16rem] flex-1"><Field label="Analyse any competitor event"><Select value={eventId} onChange={(e) => setEventId(e.target.value)}><option value="">Choose an event…</option>{(evs.data?.items || []).filter((e: any) => !e.superseded_by_id).map((e: any) => <option key={e.id} value={e.id}>{e.competitor_name}: {e.title}</option>)}</Select></Field></div>
        <Button variant="memory" disabled={!eventId} loading={run.isPending} onClick={() => run.mutate()}><Brain className="h-4 w-4" />Generate recommendation</Button></div></Card>
      {rec ? <RecommendationView r={rec} /> : <Card><div className="p-10 text-center text-sm text-muted">Choose an event or run the guided demo to see a recommendation with its supporting evidence.</div></Card>}
    </>
  );
}
