import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { api, fdate, nice } from "../lib/api";
import { Badge, Card, CardHead, CatBadge, Empty, Notice, PageHeader, Q, SimBadge, VerifBadge } from "../components/ui";

export default function Signals() {
  const [win, setWin] = useState(240);
  const q = useQuery({ queryKey: ["signals", win], queryFn: () => api.get(`/strategy-signals?window_days=${win}`) });
  return (
    <>
      <PageHeader title="Strategy signals" sub="Related competitor events fused across time into possible strategic shifts. These are hypotheses built from public activity, never confirmed strategy." />
      <div className="mb-5 flex items-center gap-3 text-sm"><label htmlFor="win" className="font-semibold">Time window</label><input id="win" type="range" min={60} max={540} step={30} value={win} onChange={(e) => setWin(Number(e.target.value))} className="w-56 accent-[rgb(var(--memory))]" /><span className="tabular-nums text-muted">{win} days</span></div>
      <Q q={q}>{(d) => d.items.length === 0 ? <Card><Empty title="No signal clusters in this window" text="A cluster needs at least three related events across two categories." /></Card> : (
        <div className="space-y-5">{d.items.map((s: any, i: number) => (
          <Card key={i}><div className="rail m-5 pl-4"><div className="flex flex-wrap items-center gap-2"><Badge tone="memory">Hypothesis</Badge><Badge tone={s.strength === "strong" ? "good" : s.strength === "moderate" ? "brand" : "neutral"}>{s.strength} evidence</Badge><Badge>{nice(s.theme)}</Badge></div>
            <h3 className="mt-2 text-lg font-extrabold">{s.hypothesis}</h3><p className="mt-1 text-sm text-muted">{s.reasoning}</p><div className="mt-3"><Notice tone="info">{s.caveat}</Notice></div></div>
            <div className="border-t border-line"><p className="px-5 pt-3 text-xs font-semibold text-muted">Supporting evidence ({s.evidence.length})</p>
              <ul className="divide-y divide-line">{s.evidence.map((e: any) => (<li key={e.id} className="flex flex-wrap items-center justify-between gap-2 px-5 py-2.5 text-sm"><span>{e.title}</span><span className="flex items-center gap-1.5"><span className="text-xs text-muted">{fdate(e.date)}</span><CatBadge c={e.category} /><VerifBadge s={e.verification_status} />{e.is_synthetic && <SimBadge />}</span></li>))}</ul></div></Card>))}</div>)}</Q>
    </>
  );
}
