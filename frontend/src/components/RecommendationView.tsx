import { Brain, Database, ShieldAlert } from "lucide-react";
import { fdate, nice, pct } from "../lib/api";
import { Badge, Card, CardHead, CatBadge, Notice, SimBadge, VerdictBadge, VerifBadge } from "./ui";

const Sec = ({ title, children, memory }: { title: string; children: React.ReactNode; memory?: boolean }) => (
  <div className={`${memory ? "rail" : "border-l-[3px] border-line"} pl-4`}><p className="mb-1.5 text-xs font-bold text-muted">{title}</p>{children}</div>
);

export default function RecommendationView({ r }: { r: any }) {
  const m = r.memory;
  return (
    <div className="space-y-5">
      <Card>
        <CardHead title="Recommendation" sub={`Generated ${new Date(r.created_at + (r.created_at.endsWith("Z") ? "" : "Z")).toLocaleString()}`}
          right={<div className="flex flex-wrap justify-end gap-1.5"><Badge tone={r.engine === "llm" ? "memory" : "neutral"}>{r.engine === "llm" ? "LLM reasoning" : "Rule-based engine"}</Badge><Badge tone={r.history_used ? "good" : "warn"}>{r.history_used ? `Uses ${r.influenced_by.length} past experience(s)` : "No relevant history"}</Badge></div>} />
        <div className="space-y-6 p-5">
          {r.warnings.map((w: string, i: number) => <Notice key={i}>{w}</Notice>)}
          {r.notes.map((w: string, i: number) => <Notice key={i} tone="info">{w}</Notice>)}
          <Sec title="Verified current event">
            <p className="font-bold">{r.event.title}</p>
            <div className="mt-1 flex flex-wrap items-center gap-1.5 text-xs text-muted"><span>{r.event.competitor}</span><span>·</span><span>{fdate(r.event.date)}</span><CatBadge c={r.event.category} /><VerifBadge s={r.event.verification_status} />{r.event.is_synthetic && <SimBadge />}</div>
          </Sec>
          <div className="rounded-xl border border-memory/40 bg-memory/10 p-4">
            <div className="flex items-center gap-2"><Brain className="h-4 w-4 text-memory" /><p className="text-sm font-bold">Recommended action</p><Badge tone="brand">{nice(r.recommended.strategy)}</Badge></div>
            <p className="mt-2 text-sm font-semibold leading-relaxed">{r.recommended.action}</p>
            <p className="mt-2 text-sm text-muted">{r.recommended.rationale}</p>
          </div>
          <Sec title="How history changed this recommendation" memory><p className="text-sm">{r.how_history_changed_it || "—"}</p></Sec>
          <Sec title="AI interpretation (a hypothesis, not a fact)"><p className="text-sm">{r.ai_interpretation}</p></Sec>
        </div>
      </Card>

      <Card>
        <CardHead title="Historical evidence and previous decisions" sub="Past company decisions on similar events, with recorded assumptions and measured outcomes (from the database). Unrelated categories are not used as evidence." />
        {r.experiences.length === 0 ? <p className="p-5 text-sm text-muted">No earlier CloudDesk decision responds to a {nice(r.event.category)} event. This recommendation is a cautious baseline.</p> : (
          <div className="divide-y divide-line">{r.experiences.map((x: any) => (
            <div key={x.decision_id} className="p-5">
              <div className="flex flex-wrap items-center gap-2"><p className="font-bold">Decision #{x.decision_id}: {x.title}</p><Badge tone="brand">{nice(x.strategy_type)}</Badge>{x.is_synthetic && <SimBadge />}{x.surfaced_by_hindsight && <Badge tone="memory"><Database className="h-3 w-3" />also recalled by Hindsight</Badge>}</div>
              <p className="mt-1 text-xs text-muted">In response to {x.trigger_competitor}: “{x.trigger_event}” ({fdate(x.trigger_date)}) · relevant because {x.relevance.join(", ")}</p>
              <div className="mt-3 grid gap-3 text-sm md:grid-cols-3">
                <div><p className="label">Recorded assumption</p><p>{x.assumption || "Not recorded"}</p></div>
                <div><p className="label">Expected</p><p>{x.expected_result || "Not recorded"}</p></div>
                <div><p className="label">Measured outcome</p>{x.outcome ? <p>Acquisition {pct(x.outcome.acquisition_change_pct)}, margin {pct(x.outcome.margin_change_pct)} over {x.outcome.measurement_days ?? "?"} days. <VerdictBadge v={x.audit.verdict} /></p> : <p className="text-muted">No measured outcome yet (missing evidence, not failure)</p>}</div>
              </div>
              {x.outcome && <p className="mt-2 text-xs text-muted">{x.audit.explanation}</p>}
            </div>))}</div>)}
        {r.competitor_history.length > 0 && <div className="border-t border-line px-5 py-3"><p className="label">Recent history of {r.event.competitor}</p><ul className="space-y-1 text-xs">{r.competitor_history.map((e: any) => <li key={e.id} className={e.superseded ? "line-through opacity-60" : ""}>{fdate(e.date)} — {e.title}</li>)}</ul></div>}
      </Card>

      <Card>
        <CardHead title="Hindsight memory" sub="Real retain/recall/reflect results for this recommendation" right={<Badge tone={m.status === "success" ? "good" : m.status === "partial" ? "warn" : "bad"}>{m.status === "unconfigured" ? "not configured" : m.status}</Badge>} />
        <div className="space-y-3 p-5 text-sm">
          {m.errors.map((e: string, i: number) => <Notice key={i} tone="bad">{e}</Notice>)}
          {m.status === "unconfigured" && <Notice>Hindsight is not configured, so no memory was recalled. Set HINDSIGHT_API_KEY in backend/.env to enable it. Nothing here is simulated.</Notice>}
          {m.status === "success" && (<>
            <p><span className="font-semibold">{m.recall_count}</span> memories recalled.</p>
            {m.reflect_text && <div className="rail pl-4"><p className="label">Reflection</p><p className="whitespace-pre-wrap">{m.reflect_text}</p></div>}
            {m.memories.length > 0 && <details><summary className="cursor-pointer text-xs font-semibold text-brand">Recalled memories ({m.memories.length})</summary><ul className="mt-2 space-y-2">{m.memories.map((x: any, i: number) => <li key={i} className="rounded-lg bg-raised p-3 text-xs"><span className="font-mono text-memory">{x.document_id || x.id}</span><p className="mt-1">{x.text}</p></li>)}</ul></details>}
            {m.based_on.length > 0 && <details><summary className="cursor-pointer text-xs font-semibold text-brand">Memories the reflection was based on ({m.based_on.length})</summary><ul className="mt-2 space-y-2">{m.based_on.map((x: any, i: number) => <li key={i} className="rounded-lg bg-raised p-3 text-xs"><span className="font-mono text-memory">{x.document_id || x.id}</span><p className="mt-1">{x.text}</p></li>)}</ul></details>}
          </>)}
        </div>
      </Card>

      <div className="grid gap-5 lg:grid-cols-2">
        <Card><CardHead title="Alternative strategies" /><div className="divide-y divide-line">{r.alternatives.map((a: any, i: number) => (<div key={i} className="px-5 py-3 text-sm"><p className="font-semibold capitalize">{nice(a.strategy)}</p><p className="text-xs text-muted">{a.summary}{a.trade_offs ? ` — ${a.trade_offs}` : ""}</p></div>))}{!r.alternatives.length && <p className="p-5 text-sm text-muted">None generated.</p>}</div></Card>
        <Card><CardHead title="Confidence and gaps" sub={r.evidence_strength} />
          <div className="space-y-4 p-5 text-sm"><div><p className="label flex items-center gap-1"><ShieldAlert className="h-3 w-3" />Uncertainty</p><ul className="list-disc space-y-1 pl-5">{r.uncertainty.map((u: string, i: number) => <li key={i}>{u}</li>)}</ul></div>
            <div><p className="label">Missing evidence</p><ul className="list-disc space-y-1 pl-5">{r.missing_evidence.map((u: string, i: number) => <li key={i}>{u}</li>)}</ul></div></div></Card>
      </div>
    </div>
  );
}
