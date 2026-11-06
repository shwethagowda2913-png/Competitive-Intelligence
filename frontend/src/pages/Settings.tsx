import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../lib/api";
import { Badge, Button, Card, CardHead, Confirm, Notice, PageHeader, Q, useToast } from "../components/ui";

const Row = ({ k, v }: { k: string; v: React.ReactNode }) => <div className="flex items-start justify-between gap-4 border-b border-line py-2.5 text-sm last:border-0"><span className="text-muted">{k}</span><span className="text-right font-medium">{v}</span></div>;

export default function SettingsPage() {
  const qc = useQueryClient(), toast = useToast();
  const [reset, setReset] = useState(false);
  const q = useQuery({ queryKey: ["integrations"], queryFn: () => api.get("/integrations") });
  const rs = useMutation({ mutationFn: () => api.post("/demo/reset"), onSuccess: () => { qc.invalidateQueries(); toast("ok", "Demo data reloaded (simulated)"); setReset(false); }, onError: (e: Error) => toast("err", e.message) });
  return (
    <>
      <PageHeader title="Settings and integrations" sub="Live status of the services behind the agent. Secrets are read from backend/.env and never reach the browser." />
      <Q q={q}>{(d) => (
        <div className="grid gap-6 lg:grid-cols-2">
          <Card><CardHead title="Hindsight memory" right={<Badge tone={d.hindsight.reachable ? "good" : d.hindsight.configured ? "bad" : "warn"}>{d.hindsight.reachable ? "connected" : d.hindsight.configured ? "unreachable" : "not configured"}</Badge>} />
            <div className="p-5"><Row k="Bank" v={<code className="font-mono text-xs">{d.hindsight.bank_id}</code>} /><Row k="Endpoint" v={<code className="font-mono text-xs">{d.hindsight.base_url}</code>} /><Row k="Records retained" v={d.hindsight.retained_items} /><Row k="Detail" v={d.hindsight.detail} />
              {!d.hindsight.configured && <div className="mt-3"><Notice>Set HINDSIGHT_API_KEY (Hindsight Cloud) or point HINDSIGHT_BASE_URL at a self-hosted instance, then restart the backend. Until then recall and reflect are skipped, not simulated.</Notice></div>}</div></Card>
          <Card><CardHead title="Language model" right={<Badge tone={d.llm.configured ? "good" : "warn"}>{d.llm.mode === "llm" ? "LLM active" : "rule-based mode"}</Badge>} />
            <div className="p-5"><Row k="Provider" v={d.llm.provider} /><Row k="Model" v={d.llm.model} /><Row k="Fallback model" v={d.llm.fallback_model} />
              {!d.llm.configured && <div className="mt-3"><Notice>No GROQ_API_KEY. Event extraction uses keyword rules and recommendations use the rule-based engine over recorded outcomes. Both are labelled in the UI.</Notice></div>}</div></Card>
          <Card><CardHead title="Database" /><div className="p-5"><Row k="Engine" v={d.database.engine} /><Row k="Company" v={d.company} /></div></Card>
          <Card><CardHead title="Demo data" sub="Synthetic CloudDesk dataset" /><div className="space-y-3 p-5 text-sm"><p className="text-muted">Replaces all data with the simulated CloudDesk history (3 competitors, 25 events, 6 decisions). Memory already in Hindsight is not removed.</p><Button variant="danger" onClick={() => setReset(true)}>Reset to demo data</Button></div></Card>
        </div>)}</Q>
      <Confirm open={reset} title="Reset all data?" text="This deletes every competitor, event, decision, outcome, recommendation and memory log in the local database and reloads the simulated demo history." confirmLabel="Reset data" onConfirm={() => rs.mutate()} onClose={() => setReset(false)} loading={rs.isPending} />
    </>
  );
}
