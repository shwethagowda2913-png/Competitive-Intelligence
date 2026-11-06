import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { AlertTriangle, ArrowRight, Brain } from "lucide-react";
import { api, CATEGORIES, fdate, nice } from "../lib/api";
import { axis, CAT_COLORS, tip } from "../lib/charts";
import { Badge, Button, Card, CardHead, CatBadge, Empty, PageHeader, Q, SimBadge, Stat } from "../components/ui";

export default function Overview() {
  const q = useQuery({ queryKey: ["dashboard"], queryFn: () => api.get("/dashboard") });
  return (
    <>
      <PageHeader title="Intelligence overview" sub="What competitors are doing, what CloudDesk did about it, and what the agent has learned. All figures come from the live database."
        actions={<Link to="/advisor"><Button variant="memory"><Brain className="h-4 w-4" />Run the guided demo</Button></Link>} />
      <Q q={q}>{(d) => {
        const ops = (op: string, st?: string) => d.memory_ops.filter((o: any) => o.op === op && (!st || o.status === st)).reduce((a: number, o: any) => a + o.count, 0);
        return (
          <div className="space-y-6">
            <div className="grid grid-cols-2 gap-4 lg:grid-cols-5">
              <Stat label="Competitors tracked" value={d.counts.competitors} />
              <Stat label="Competitor events" value={d.counts.events} sub={`${d.counts.unverified_events} not yet verified`} />
              <Stat label="Decisions recorded" value={d.counts.decisions} sub={`${d.counts.outcomes_measured} with measured outcomes`} />
              <Stat label="Recommendations made" value={d.counts.recommendations} />
              <Link to="/audit"><Stat label="Data-health warnings" value={d.warnings_total} sub="Stale, superseded or conflicting" /></Link>
            </div>
            <div className="grid gap-6 lg:grid-cols-3">
              <Card className="lg:col-span-2">
                <CardHead title="Competitor activity by month" sub="Events grouped by category" />
                <div className="h-72 p-4">{d.events_by_month.length ? (
                  <ResponsiveContainer><BarChart data={d.events_by_month}><CartesianGrid stroke="rgb(var(--line))" vertical={false} /><XAxis dataKey="month" {...axis} /><YAxis allowDecimals={false} {...axis} /><Tooltip {...tip} /><Legend formatter={nice} wrapperStyle={{ fontSize: 11 }} />
                    {CATEGORIES.map((c) => <Bar key={c} dataKey={c} stackId="a" fill={CAT_COLORS[c]} />)}</BarChart></ResponsiveContainer>) : <Empty title="No dated events yet" />}</div>
              </Card>
              <Card>
                <CardHead title="Hindsight activity" sub="Logged operations (see Memory Explorer)" />
                <div className="space-y-3 p-5 text-sm">
                  {(["retain", "recall", "reflect"] as const).map((o) => (
                    <div key={o} className="flex items-center justify-between"><span className="font-semibold capitalize">{o}</span>
                      <span className="flex gap-1.5"><Badge tone="good">{ops(o, "success")} ok</Badge>{ops(o, "error") > 0 && <Badge tone="bad">{ops(o, "error")} failed</Badge>}{ops(o, "skipped") > 0 && <Badge tone="warn">{ops(o, "skipped")} skipped</Badge>}</span></div>
                  ))}
                  {!d.memory_ops.length && <p className="text-xs text-muted">No memory operations yet. Record an event or run the guided demo.</p>}
                  <Link to="/memory" className="inline-flex items-center gap-1 text-xs font-semibold text-brand">Open Memory Explorer <ArrowRight className="h-3 w-3" /></Link>
                </div>
              </Card>
            </div>
            <div className="grid gap-6 lg:grid-cols-2">
              <Card>
                <CardHead title="Strongest strategy hypotheses" sub="Inferred from patterns — not confirmed competitor strategy" right={<Link to="/signals" className="text-xs font-semibold text-brand">All signals</Link>} />
                <div className="divide-y divide-line">{d.signals.length ? d.signals.map((s: any, i: number) => (
                  <div key={i} className="px-5 py-3.5"><div className="flex items-center gap-2"><Badge tone="memory">Hypothesis</Badge><Badge tone={s.strength === "strong" ? "good" : "neutral"}>{s.strength}</Badge></div>
                    <p className="mt-1.5 text-sm font-semibold">{s.hypothesis}</p><p className="mt-0.5 text-xs text-muted">{s.reasoning}</p></div>)) : <Empty title="No signal clusters yet" text="Signals appear when several related events from one competitor accumulate." />}</div>
              </Card>
              <Card>
                <CardHead title="Latest competitor events" right={<Link to="/timeline" className="text-xs font-semibold text-brand">Timeline</Link>} />
                <div className="divide-y divide-line">{d.recent_events.map((e: any) => (
                  <Link key={e.id} to={`/advisor?event=${e.id}`} className="flex items-center justify-between gap-3 px-5 py-3 hover:bg-raised/60">
                    <div className="min-w-0"><p className="truncate text-sm font-semibold">{e.title}</p><p className="text-xs text-muted">{e.competitor} · {fdate(e.date)}</p></div>
                    <div className="flex shrink-0 gap-1.5"><CatBadge c={e.category} />{e.is_synthetic && <SimBadge />}</div></Link>))}</div>
              </Card>
            </div>
            {d.warnings_total > 0 && <div className="flex items-center gap-2 rounded-lg border border-warn/40 bg-warn/10 px-4 py-3 text-sm"><AlertTriangle className="h-4 w-4 text-warn" />{d.warnings_total} data-health warnings may weaken recommendations. <Link to="/audit?tab=health" className="font-semibold text-brand">Review them</Link></div>}
          </div>);
      }}</Q>
    </>
  );
}
