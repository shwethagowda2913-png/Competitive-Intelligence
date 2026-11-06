import { useQuery } from "@tanstack/react-query";
import { ArrowDown } from "lucide-react";
import { api, fdt, nice } from "../lib/api";
import { Badge, Card, Empty, PageHeader, Q, SimBadge } from "../components/ui";

export default function Evolution() {
  const q = useQuery({ queryKey: ["evo"], queryFn: () => api.get("/memory-evolution") });
  return (
    <>
      <PageHeader title="Memory evolution" sub="How recommendations change as events, decisions and outcomes are retained. Each card shows what experience was used and what changed since the previous recommendation for the same kind of event." />
      <Q q={q}>{(d) => d.items.length === 0 ? <Card><Empty title="No recommendations yet" text="Run the guided demo in the Strategic AI advisor to see the agent's recommendations evolve." /></Card> : (
        <ol className="space-y-3">{d.items.map((e: any, i: number) => (
          <li key={e.recommendation_id}>{i > 0 && <div className="my-1 flex justify-center"><ArrowDown className="h-4 w-4 text-muted" /></div>}
            <Card><div className="space-y-3 p-5">
              <div className="flex flex-wrap items-center gap-2"><p className="font-bold">Recommendation #{e.recommendation_id}: {e.event_title}</p>{e.is_synthetic && <SimBadge />}<Badge tone="brand">{nice(e.strategy)}</Badge><Badge>{e.engine === "llm" ? "LLM" : "rule-based"}</Badge></div>
              <p className="text-xs text-muted">{e.competitor} · {nice(e.category)} · {fdt(e.created_at)}</p>
              <div className="grid gap-3 text-sm md:grid-cols-3">
                <div className="rounded-lg bg-raised p-3"><p className="label">Recalled</p><p>{e.recalled_count} Hindsight memories ({e.memory_status || "n/a"})</p></div>
                <div className="rounded-lg bg-raised p-3"><p className="label">Experience used</p><p>{e.experiences_used.length ? `Decisions #${e.experiences_used.join(", #")}` : "None — no relevant history"}</p></div>
                <div className="rounded-lg bg-raised p-3"><p className="label">Learned / changed</p><p>{e.delta ? (e.delta.strategy_changed ? `Strategy changed from ${nice(e.delta.previous_strategy)} to ${nice(e.strategy)}` : "Strategy unchanged") : "First recommendation of this kind"}</p></div>
              </div>
              {e.delta && <div className="rail pl-4 text-sm"><p>Compared with #{e.delta.previous_recommendation_id}: {e.delta.previously_no_history ? "that one had no history. " : ""}{e.delta.new_experiences.length ? `New experience: decisions #${e.delta.new_experiences.join(", #")}. ` : "No new experience. "}{e.delta.retained_since_previous.length} item(s) retained to Hindsight in between.</p></div>}
              <p className="text-sm text-muted">{e.how_history_changed_it}</p>
            </div></Card></li>))}</ol>)}</Q>
    </>
  );
}
