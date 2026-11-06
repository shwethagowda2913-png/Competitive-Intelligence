import { useQuery } from "@tanstack/react-query";
import { Link, useSearchParams } from "react-router-dom";
import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { api, nice, pct } from "../lib/api";
import { axis, tip } from "../lib/charts";
import { Badge, Card, CardHead, Empty, Notice, PageHeader, Q, SimBadge, Stat, VerdictBadge } from "../components/ui";

export function DecisionDNA() {
  const q = useQuery({ queryKey: ["dna"], queryFn: () => api.get("/decision-dna") });
  return (
    <>
      <PageHeader title="Decision DNA" sub="CloudDesk's recurring response patterns, computed only from recorded decisions and outcomes." />
      <Q q={q}>{(d) => d.total_decisions === 0 ? <Card><Empty title="No decisions yet" text="Record decisions to build the company's response profile." /></Card> : (
        <div className="space-y-6">
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            <Stat label="Decisions" value={d.total_decisions} /><Stat label="Events answered" value={`${d.events_responded}/${d.events_total}`} sub="Share of competitor events with a recorded response" />
            <Stat label="Positive outcomes" value={d.positive.length} /><Stat label="Negative or mixed" value={d.negative.length + d.mixed.length} sub={`${d.pending} awaiting outcome`} />
          </div>
          <div className="grid gap-6 lg:grid-cols-2">
            <Card><CardHead title="Strategies used" /><div className="h-64 p-4"><ResponsiveContainer><BarChart data={Object.entries(d.by_strategy).map(([k, v]) => ({ name: nice(k), count: v }))} layout="vertical"><CartesianGrid stroke="rgb(var(--line))" horizontal={false} /><XAxis type="number" allowDecimals={false} {...axis} /><YAxis type="category" dataKey="name" width={120} {...axis} /><Tooltip {...tip} /><Bar dataKey="count" fill="#A78BFA" radius={[0, 6, 6, 0]} /></BarChart></ResponsiveContainer></div></Card>
            <Card><CardHead title="Same strategy, different results" sub="Where the context probably mattered" />
              <div className="divide-y divide-line">{d.same_strategy_different_results.length ? d.same_strategy_different_results.map((p: any, i: number) => (<div key={i} className="px-5 py-3 text-sm"><p className="font-semibold capitalize">{nice(p.strategy_type)} · {nice(p.category)}</p><p className="text-xs text-muted">{p.count} decisions: {Object.entries(p.statuses).map(([k, v]) => `${v} ${k}`).join(", ")}. Compare the circumstances before repeating it.</p></div>)) : <Empty title="None yet" text="No strategy has produced conflicting results so far." />}</div></Card>
          </div>
          <Card><CardHead title="Response patterns" sub="Category × strategy" /><div className="overflow-x-auto"><table className="w-full"><thead className="border-b border-line"><tr><th className="th">Event category</th><th className="th">Strategy</th><th className="th">Times used</th><th className="th">Outcomes</th><th className="th">Flags</th></tr></thead>
            <tbody className="divide-y divide-line">{d.patterns.map((p: any, i: number) => (<tr key={i}><td className="td capitalize">{nice(p.category)}</td><td className="td capitalize">{nice(p.strategy_type)}</td><td className="td tabular-nums">{p.count}</td><td className="td text-xs">{Object.entries(p.statuses).map(([k, v]) => <Badge key={k} tone={k === "success" ? "good" : k === "failure" ? "bad" : k === "mixed" ? "warn" : "neutral"}>{v as number} {k}</Badge>)}</td><td className="td">{p.repeated && <Badge tone="memory">repeated</Badge>} {p.inconsistent && <Badge tone="warn">inconsistent</Badge>}</td></tr>))}</tbody></table></div></Card>
          <div className="grid gap-6 lg:grid-cols-3">{([["Worked", d.positive, "good"], ["Mixed", d.mixed, "warn"], ["Did not work", d.negative, "bad"]] as const).map(([t, list, tone]) => (
            <Card key={t}><CardHead title={t} />{list.length ? <ul className="divide-y divide-line">{list.map((x: any) => <li key={x.id} className="px-5 py-3 text-sm"><p className="font-semibold">{x.title}</p><p className="text-xs text-muted">{nice(x.strategy_type)} · acq {pct(x.acquisition)} · margin {pct(x.margin)} {x.is_synthetic && <SimBadge />}</p></li>)}</ul> : <p className="p-5 text-sm text-muted">None recorded.</p>}</Card>))}</div>
        </div>)}</Q>
    </>
  );
}

export function Audit() {
  const [sp, setSp] = useSearchParams();
  const tab = sp.get("tab") === "health" ? "health" : "audit";
  const a = useQuery({ queryKey: ["audit"], queryFn: () => api.get("/assumption-audit") });
  const h = useQuery({ queryKey: ["health"], queryFn: () => api.get("/health-warnings") });
  return (
    <>
      <PageHeader title="Assumption audit" sub="Each recorded assumption is compared with measured results. Contradictions, stale evidence and thin measurements are flagged separately." />
      <div className="mb-5 flex gap-2" role="tablist">{[["audit", "Assumptions"], ["health", `Data health${h.data ? ` (${h.data.total})` : ""}`]].map(([k, l]) => <button key={k} role="tab" aria-selected={tab === k} onClick={() => setSp(k === "audit" ? {} : { tab: k })} className={`rounded-lg px-3 py-1.5 text-sm font-semibold ${tab === k ? "bg-memory/15 text-memory" : "text-muted hover:bg-raised"}`}>{l}</button>)}</div>
      {tab === "audit" ? <Q q={a}>{(d) => (
        <div className="space-y-5">
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-5">{["supported", "mixed", "failed", "pending", "unmeasured"].map((k) => <Stat key={k} label={k} value={d.counts[k] || 0} />)}</div>
          {d.repeated_mistakes.map((m: any, i: number) => <Notice key={i} tone="bad"><b>Repeated pattern.</b> {m.note}</Notice>)}
          {d.missing_evidence.length > 0 && <Notice tone="info">{d.missing_evidence.length} decision(s) lack measured results or comparable metrics: #{d.missing_evidence.join(", #")}. This is missing evidence, not failure.</Notice>}
          <Card><div className="divide-y divide-line">{d.items.length === 0 && <Empty title="No decisions to audit" />}{d.items.map((x: any) => (
            <div key={x.decision_id} className="p-5"><div className="flex flex-wrap items-center gap-2"><p className="font-bold">#{x.decision_id} {x.title}</p><VerdictBadge v={x.verdict} /><Badge tone="brand">{nice(x.strategy_type)}</Badge>{x.is_synthetic && <SimBadge />}</div>
              <p className="mt-1 text-sm"><span className="text-muted">Assumption:</span> {x.assumption || "not recorded"}</p>
              {x.checks.length > 0 && <table className="mt-3 w-full max-w-md text-xs"><thead><tr className="text-muted"><th className="py-1 text-left">Metric</th><th className="text-left">Expected</th><th className="text-left">Measured</th><th className="text-left">Result</th></tr></thead><tbody>{x.checks.map((c: any) => <tr key={c.metric}><td className="py-1 capitalize">{c.metric}</td><td>{pct(c.expected)}</td><td>{pct(c.actual)}</td><td><Badge tone={c.met ? "good" : "bad"}>{c.met ? "met" : "not met"}</Badge></td></tr>)}</tbody></table>}
              <p className="mt-2 text-xs text-muted">{x.explanation}</p>{x.warnings.map((w: string, i: number) => <p key={i} className="mt-1 text-xs text-warn">⚠ {w}</p>)}</div>))}</div></Card></div>)}</Q>
      : <Q q={h}>{(d) => (
        <div className="space-y-5">
          {d.total === 0 && <Card><Empty title="No warnings" text="No stale, superseded, disputed or conflicting evidence detected." /></Card>}
          {d.conflicts.length > 0 && <Card><CardHead title="Conflicting sources" /><ul className="divide-y divide-line">{d.conflicts.map((c: any, i: number) => <li key={i} className="px-5 py-3 text-sm"><b>{c.competitor}</b> · {nice(c.category)} — {c.detail} <span className="text-xs text-muted">(events #{c.event_ids.join(", #")})</span></li>)}</ul></Card>}
          {d.superseded_events.length > 0 && <Card><CardHead title="Superseded events" sub="Excluded from signals and recommendations" /><ul className="divide-y divide-line">{d.superseded_events.map((e: any) => <li key={e.event_id} className="px-5 py-3 text-sm">#{e.event_id} {e.title} → replaced by #{e.superseded_by}</li>)}</ul></Card>}
          {d.disputed_events.length > 0 && <Card><CardHead title="Disputed events" /><ul className="divide-y divide-line">{d.disputed_events.map((e: any) => <li key={e.event_id} className="px-5 py-3 text-sm">#{e.event_id} {e.title}</li>)}</ul></Card>}
          {d.stale_events.length > 0 && <Card><CardHead title="Outdated evidence" sub="Older than 270 days and not superseded" /><ul className="divide-y divide-line">{d.stale_events.map((e: any) => <li key={e.event_id} className="px-5 py-3 text-sm">#{e.event_id} {e.title} <span className="text-xs text-muted">({e.age_days} days old)</span></li>)}</ul></Card>}
          {d.short_measurement.length > 0 && <Card><CardHead title="Outcomes with insufficient measurement period" sub="Under 30 days" /><ul className="divide-y divide-line">{d.short_measurement.map((e: any) => <li key={e.decision_id} className="px-5 py-3 text-sm">Decision #{e.decision_id} {e.title} — {e.days ?? "unknown"} days</li>)}</ul></Card>}
          {d.recommendations_with_old_evidence.length > 0 && <Card><CardHead title="Recommendations relying on old information" /><ul className="divide-y divide-line">{d.recommendations_with_old_evidence.map((r: any) => <li key={r.recommendation_id} className="px-5 py-3 text-sm">Recommendation #{r.recommendation_id}: {r.warnings.join("; ")}</li>)}</ul></Card>}
        </div>)}</Q>}
    </>
  );
}

export function Effectiveness() {
  const q = useQuery({ queryKey: ["eff"], queryFn: () => api.get("/effectiveness") });
  const cf = useQuery({ queryKey: ["cf"], queryFn: () => api.get("/counterfactual?category=pricing") });
  return (
    <>
      <PageHeader title="Response effectiveness" sub="Recorded strategies compared on the metrics they share. Associations only — no claim of causality." />
      <Q q={q}>{(d) => (
        <div className="space-y-6">
          <Notice tone="info">{d.disclaimer}</Notice>
          {d.strategies.length === 0 ? <Card><Empty title="No measured outcomes yet" text="Record outcomes for decisions to compare strategies." action={<Link to="/decisions" className="text-sm font-semibold text-brand">Go to decisions</Link>} /></Card> : (<>
            <Card><CardHead title="Average measured change by strategy" /><div className="h-72 p-4"><ResponsiveContainer><BarChart data={d.strategies.map((s: any) => ({ name: nice(s.strategy_type), acquisition: s.avg_acquisition_pct, margin: s.avg_margin_pct }))}><CartesianGrid stroke="rgb(var(--line))" vertical={false} /><XAxis dataKey="name" {...axis} /><YAxis unit="%" {...axis} /><Tooltip {...tip} /><Legend wrapperStyle={{ fontSize: 11 }} /><Bar dataKey="acquisition" name="Acquisition change" fill="#5B9DF5" radius={[4, 4, 0, 0]} /><Bar dataKey="margin" name="Margin change" fill="#E0A030" radius={[4, 4, 0, 0]} /></BarChart></ResponsiveContainer></div></Card>
            <Card><div className="overflow-x-auto"><table className="w-full"><thead className="border-b border-line"><tr><th className="th">Strategy</th><th className="th">Cases</th><th className="th">Avg acquisition</th><th className="th">Avg margin</th><th className="th">Measured over</th><th className="th">Limitations</th></tr></thead>
              <tbody className="divide-y divide-line">{d.strategies.map((s: any) => (<tr key={s.strategy_type}><td className="td font-semibold capitalize">{nice(s.strategy_type)} {s.is_synthetic && <SimBadge />}</td><td className="td tabular-nums">{s.n}</td><td className="td tabular-nums">{pct(s.avg_acquisition_pct)} <span className="text-xs text-muted">(n={s.n_acquisition})</span></td><td className="td tabular-nums">{pct(s.avg_margin_pct)} <span className="text-xs text-muted">(n={s.n_margin})</span></td><td className="td text-xs">{s.days_min === null ? "unknown" : s.days_min === s.days_max ? `${s.days_min} days` : `${s.days_min}–${s.days_max} days`}</td><td className="td text-xs text-warn">{s.caveats.map((c: string, i: number) => <p key={i}>⚠ {c}</p>)}</td></tr>))}</tbody></table></div></Card></>)}
        </div>)}</Q>
      <h2 className="mb-1 mt-10 text-lg font-extrabold">Counterfactual comparison for pricing events</h2>
      <p className="mb-4 text-sm text-muted">Scenario thinking from recorded experience only. Hypothetical — not predictions.</p>
      <Q q={cf}>{(d) => (<><div className="mb-3"><Badge tone="warn">{d.label}</Badge></div><div className="grid gap-4 md:grid-cols-2">{d.options.map((o: any) => (
        <Card key={o.strategy_type}><div className="p-5"><div className="flex items-center justify-between"><p className="font-bold">{o.name}</p><Badge tone={o.recorded_experience ? "brand" : "neutral"}>{o.recorded_experience} recorded case(s)</Badge></div><p className="mt-1 text-xs text-muted">{o.description}</p><p className="mt-3 text-sm">{o.hypothetical_note}</p>{o.caveats?.map((c: string, i: number) => <p key={i} className="mt-1 text-xs text-warn">⚠ {c}</p>)}</div></Card>))}</div></>)}</Q>
    </>
  );
}
