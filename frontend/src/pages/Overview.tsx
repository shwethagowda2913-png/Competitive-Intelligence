import { Link } from "react-router-dom";
import {
  Activity,
  ArrowDown,
  ArrowRight,
  ArrowUpRight,
  BrainCircuit,
  Building2,
  CalendarDays,
  CheckCircle2,
  Database,
  GitBranch,
  Lightbulb,
  Radar,
  RefreshCw,
  ShieldCheck,
  Target,
  Workflow,
  ChartNoAxesCombined,
  Sparkles,
} from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { api } from "../lib/api";
import { Q } from "../components/ui";

type Node = {
  name: string;
  detail: string;
  icon: React.ElementType;
  to: string;
  tone: string;
};

type Pipeline = {
  id: string;
  title: string;
  subtitle: string;
  accent: string;
  border: string;
  tint: string;
  nodes: Node[];
};

const pipelines: Pipeline[] = [
  {
    id: "01",
    title: "Competitive intelligence",
    subtitle: "Transform competitor activity into actionable market signals",
    accent: "text-cyan-400",
    border: "border-cyan-400/30",
    tint: "bg-cyan-400/[0.045]",
    nodes: [
      { name: "Competitors", detail: "Manage competitor profiles", icon: Building2, to: "/competitors", tone: "text-cyan-400" },
      { name: "Event collection", detail: "Collect market activity", icon: Radar, to: "/events", tone: "text-sky-400" },
      { name: "Classification", detail: "Categorize collected events", icon: Activity, to: "/events", tone: "text-blue-400" },
      { name: "Verification", detail: "Check evidence and reliability", icon: ShieldCheck, to: "/events", tone: "text-indigo-400" },
      { name: "Competitive timeline", detail: "Understand event history", icon: CalendarDays, to: "/timeline", tone: "text-violet-400" },
      { name: "Pattern detection", detail: "Identify strategic hypotheses", icon: Lightbulb, to: "/signals", tone: "text-amber-400" },
    ],
  },
  {
    id: "02",
    title: "Strategic decision workflow",
    subtitle: "Convert market intelligence into decisions and measurable outcomes",
    accent: "text-indigo-400",
    border: "border-indigo-400/30",
    tint: "bg-indigo-400/[0.045]",
    nodes: [
      { name: "Market signals", detail: "Review detected hypotheses", icon: Radar, to: "/signals", tone: "text-cyan-400" },
      { name: "AI strategy advisor", detail: "Generate evidence-based guidance", icon: BrainCircuit, to: "/advisor", tone: "text-indigo-400" },
      { name: "Recommendations", detail: "Evaluate proposed strategies", icon: Sparkles, to: "/advisor", tone: "text-violet-400" },
      { name: "Decision tracking", detail: "Record selected actions", icon: Target, to: "/decisions", tone: "text-blue-400" },
      { name: "Assumption audit", detail: "Review decision assumptions", icon: ShieldCheck, to: "/audit", tone: "text-amber-400" },
      { name: "Effectiveness", detail: "Evaluate recorded outcomes", icon: ChartNoAxesCombined, to: "/effectiveness", tone: "text-emerald-400" },
    ],
  },
  {
    id: "03",
    title: "Organizational learning workflow",
    subtitle: "Turn past decisions and outcomes into reusable organizational experience",
    accent: "text-purple-400",
    border: "border-purple-400/30",
    tint: "bg-purple-400/[0.045]",
    nodes: [
      { name: "Decisions", detail: "Retrieve recorded decisions", icon: Target, to: "/decisions", tone: "text-indigo-400" },
      { name: "Actual outcomes", detail: "Review measured results", icon: CheckCircle2, to: "/effectiveness", tone: "text-emerald-400" },
      { name: "Hindsight memory", detail: "Retain experience", icon: BrainCircuit, to: "/memory", tone: "text-purple-400" },
      { name: "Decision DNA", detail: "Explore decision patterns", icon: GitBranch, to: "/dna", tone: "text-fuchsia-400" },
      { name: "Memory explorer", detail: "Inspect stored memories", icon: Database, to: "/memory", tone: "text-violet-400" },
      { name: "Memory evolution", detail: "Review memory activity", icon: RefreshCw, to: "/evolution", tone: "text-amber-400" },
    ],
  },
];

const supportModules = [
  { name: "Settings & integrations", icon: Database, to: "/settings" },
  { name: "Assumption audit", icon: ShieldCheck, to: "/audit" },
  { name: "Memory explorer", icon: Database, to: "/memory" },
];

function WorkflowLane({ pipeline }: { pipeline: Pipeline }) {
  return (
    <section className={`overflow-hidden rounded-2xl border ${pipeline.border} ${pipeline.tint} p-4 sm:p-5`}>
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className={`flex h-9 w-9 items-center justify-center rounded-xl border ${pipeline.border} bg-surface`}>
            <Workflow size={17} className={pipeline.accent} />
          </div>

          <div>
            <div className="flex items-center gap-2">
              <span className="font-mono text-xs text-muted">{pipeline.id}</span>
              <h2 className="text-base font-semibold text-ink">
                {pipeline.title}
              </h2>
            </div>
            <p className="mt-1 text-sm text-muted">{pipeline.subtitle}</p>
          </div>
        </div>

        <span className={`rounded-full border ${pipeline.border} px-2.5 py-1 text-xs font-semibold ${pipeline.accent}`}>
          {pipeline.nodes.length} stages
        </span>
      </div>

      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        {pipeline.nodes.map((node, index) => {
          const Icon = node.icon;

          return (
            <div key={node.name} className="flex min-w-0 flex-col">
              <Link
                to={node.to}
                className={`group relative flex min-h-[116px] flex-1 flex-col justify-between rounded-xl border border-line bg-surface/90 p-3 transition-all duration-200 hover:-translate-y-1 hover:border-current hover:shadow-lg ${node.tone}`}
              >
                <div className="flex items-center justify-between">
                  <div className={`flex h-8 w-8 items-center justify-center rounded-lg bg-raised ${node.tone}`}>
                    <Icon size={17} />
                  </div>

                  <span className="font-mono text-xs text-muted">
                    {String(index + 1).padStart(2, "0")}
                  </span>
                </div>

                <div className="mt-4">
                  <h3 className="text-sm font-semibold leading-5 text-ink group-hover:text-current">
                    {node.name}
                  </h3>
                  <p className="mt-1 text-xs leading-4 text-muted">
                    {node.detail}
                  </p>
                </div>

                <ArrowUpRight
                  size={13}
                  className="absolute right-3 top-3 text-muted opacity-0 transition group-hover:opacity-100"
                />
              </Link>

              {index < pipeline.nodes.length - 1 && (
                <>
                  <div className="hidden items-center justify-center py-1 lg:flex xl:hidden">
                    <ArrowDown size={14} className="text-muted" />
                  </div>
                  <div className="hidden items-center justify-center py-1 xl:flex">
                    <ArrowRight size={14} className={pipeline.accent} />
                  </div>
                </>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}

function MemoryEngine() {
  const stages = [
    {
      name: "RETAIN",
      description: "Store decisions, events and experience",
      tone: "text-indigo-400",
      border: "border-indigo-400/40",
      background: "bg-indigo-400/[0.08]",
      number: "01",
    },
    {
      name: "RECALL",
      description: "Retrieve relevant historical context",
      tone: "text-cyan-400",
      border: "border-cyan-400/40",
      background: "bg-cyan-400/[0.08]",
      number: "02",
    },
    {
      name: "REFLECT",
      description: "Reason about previous experience",
      tone: "text-emerald-400",
      border: "border-emerald-400/40",
      background: "bg-emerald-400/[0.08]",
      number: "03",
    },
  ];

  return (
    <section className="overflow-hidden rounded-2xl border border-amber-400/30 bg-amber-400/[0.035] p-4 sm:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-amber-400/30 bg-amber-400/10 text-amber-400">
            <BrainCircuit size={21} />
          </div>

          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.15em] text-amber-400">
              EXPERIENCE & MEMORY LAYER
            </p>

            <h2 className="mt-1 text-base font-semibold text-ink">
              Hindsight memory engine
            </h2>

            <p className="mt-1 text-sm text-muted">
              Historical experience supports future strategic reasoning.
            </p>
          </div>
        </div>

        <Link
          to="/memory"
          className="inline-flex items-center gap-1 text-sm font-semibold text-amber-400 hover:underline"
        >
          Explore memory <ArrowUpRight size={13} />
        </Link>
      </div>

      <div className="mt-6 grid gap-2 md:grid-cols-3">
        {stages.map((stage, index) => (
          <div key={stage.name} className="flex items-center gap-2">
            <div className={`min-h-[112px] flex-1 rounded-xl border ${stage.border} ${stage.background} p-4`}>
              <div className="flex items-center justify-between">
                <span className={`font-mono text-xs ${stage.tone}`}>
                  {stage.number}
                </span>

                <span className={`h-2 w-2 rounded-full ${stage.tone.replace("text-", "bg-")}`} />
              </div>

              <h3 className={`mt-3 font-mono text-base font-bold tracking-wider ${stage.tone}`}>
                {stage.name}
              </h3>

              <p className="mt-2 text-sm leading-4 text-muted">
                {stage.description}
              </p>
            </div>

            {index < stages.length - 1 && (
              <ArrowRight size={16} className={`shrink-0 ${stage.tone}`} />
            )}
          </div>
        ))}
      </div>

      <div className="my-5 flex items-center justify-center gap-2">
        <div className="h-px flex-1 bg-gradient-to-r from-transparent via-amber-400/40 to-amber-400/40" />

        <span className="rounded-full border border-amber-400/30 bg-surface px-3 py-1.5 text-xs font-medium text-amber-400">
          Historical context informs future recommendations
        </span>

        <div className="h-px flex-1 bg-gradient-to-l from-transparent via-amber-400/40 to-amber-400/40" />
      </div>

      <Link
        to="/advisor"
        className="group flex flex-wrap items-center justify-between gap-3 rounded-xl border border-violet-400/40 bg-violet-400/[0.07] p-4 transition hover:border-violet-400/70 hover:bg-violet-400/[0.11]"
      >
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-violet-400/10 text-violet-400">
            <Sparkles size={18} />
          </div>

          <div>
            <p className="text-base font-semibold text-ink">
              AI Strategy Advisor
            </p>

            <p className="mt-1 text-sm text-muted">
              Uses current intelligence and relevant historical context
            </p>
          </div>
        </div>

        <span className="inline-flex items-center gap-1 text-sm font-semibold text-violet-400">
          Open advisor
          <ArrowUpRight size={14} className="transition group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
        </span>
      </Link>

      <div className="mt-4 flex items-center justify-center gap-2 text-xs text-muted">
        <RefreshCw size={12} className="text-emerald-400" />
        New decisions and measured outcomes can become future memory
      </div>
    </section>
  );
}

export default function Overview() {
  const q = useQuery({
    queryKey: ["dashboard"],
    queryFn: () => api.get("/dashboard"),
  });

  return (
    <Q q={q}>
      {(d: any) => (
        <div className="mx-auto max-w-[1600px] space-y-6 pb-8">
          <header className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <h1 className="text-3xl font-semibold tracking-tight text-ink sm:text-4xl">
                Competitive Intelligence
              </h1>

              <p className="mt-2 max-w-2xl text-sm leading-5 text-muted">
                Follow the complete journey from competitor intelligence to strategic decisions,
                organizational learning and memory-informed recommendations.
              </p>
            </div>

            <Link
              to="/advisor"
              className="inline-flex items-center gap-2 rounded-lg bg-brand px-4 py-2.5 text-sm font-semibold text-white transition hover:brightness-110"
            >
              <Sparkles size={14} />
              Open AI advisor
              <ArrowUpRight size={14} />
            </Link>
          </header>

          <section className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {[
              { label: "Competitors", value: d.counts.competitors, icon: Building2, to: "/competitors", tone: "text-cyan-400" },
              { label: "Market events", value: d.counts.events, icon: Radar, to: "/events", tone: "text-sky-400" },
              { label: "Decisions", value: d.counts.decisions, icon: Target, to: "/decisions", tone: "text-indigo-400" },
              { label: "Measured outcomes", value: d.counts.outcomes_measured, icon: CheckCircle2, to: "/effectiveness", tone: "text-emerald-400" },
            ].map((metric) => {
              const Icon = metric.icon;

              return (
                <Link
                  key={metric.label}
                  to={metric.to}
                  className="group flex items-center gap-3 rounded-xl border border-line bg-surface p-3 transition hover:-translate-y-0.5 hover:border-brand/40"
                >
                  <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-raised ${metric.tone}`}>
                    <Icon size={18} />
                  </div>

                  <div className="min-w-0">
                    <p className="font-mono text-2xl font-semibold tabular-nums text-ink">
                      {metric.value ?? 0}
                    </p>

                    <p className="truncate text-xs text-muted">
                      {metric.label}
                    </p>
                  </div>

                  <ArrowUpRight
                    size={13}
                    className="ml-auto text-muted opacity-0 transition group-hover:opacity-100"
                  />
                </Link>
              );
            })}
          </section>

          <div className="flex items-center gap-3">
            <div className="h-px flex-1 bg-line" />

            <span className="text-xs font-semibold uppercase tracking-[0.16em] text-muted">
              Platform workflows
            </span>

            <div className="h-px flex-1 bg-line" />
          </div>

          <div className="space-y-4">
            {pipelines.map((pipeline) => (
              <WorkflowLane key={pipeline.id} pipeline={pipeline} />
            ))}
          </div>

          <MemoryEngine />

          <section className="flex flex-wrap items-center justify-between gap-3 border-t border-line pt-5">
            <div>
              <p className="text-sm font-semibold text-ink">
                Supporting workspaces
              </p>

              <p className="mt-1 text-xs text-muted">
                Additional tools connected to the intelligence workflow
              </p>
            </div>

            <div className="flex flex-wrap gap-2">
              {supportModules.map((module) => {
                const Icon = module.icon;

                return (
                  <Link
                    key={module.name}
                    to={module.to}
                    className="inline-flex items-center gap-2 rounded-lg border border-line bg-surface px-3 py-2 text-sm text-muted transition hover:border-brand/40 hover:text-ink"
                  >
                    <Icon size={14} />
                    {module.name}
                  </Link>
                );
              })}
            </div>
          </section>
        </div>
      )}
    </Q>
  );
}