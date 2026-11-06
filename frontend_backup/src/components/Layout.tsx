import { NavLink, Outlet } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Activity, BarChart3, Brain, Building2, CalendarClock, ClipboardCheck, Dna, FileSearch, GitBranch, History, LayoutDashboard, Menu, Moon, Radar, Scale, Settings, Sun, X } from "lucide-react";
import { useEffect, useState } from "react";
import { api } from "../lib/api";
import { cx } from "./ui";

const NAV = [
  { group: "Monitor", items: [
    { to: "/", label: "Intelligence overview", icon: LayoutDashboard, end: true },
    { to: "/competitors", label: "Competitors", icon: Building2 },
    { to: "/events", label: "Event intelligence", icon: FileSearch },
    { to: "/timeline", label: "Competitive timeline", icon: CalendarClock },
    { to: "/signals", label: "Strategy signals", icon: Radar },
  ] },
  { group: "Decide", items: [
    { to: "/advisor", label: "Strategic AI advisor", icon: Brain },
    { to: "/decisions", label: "Decisions & outcomes", icon: GitBranch },
  ] },
  { group: "Learn", items: [
    { to: "/dna", label: "Decision DNA", icon: Dna },
    { to: "/audit", label: "Assumption audit", icon: ClipboardCheck },
    { to: "/effectiveness", label: "Response effectiveness", icon: BarChart3 },
    { to: "/evolution", label: "Memory evolution", icon: History },
    { to: "/memory", label: "Memory explorer", icon: Activity },
  ] },
  { group: "System", items: [{ to: "/settings", label: "Settings & integrations", icon: Settings }] },
];

export default function Layout() {
  const [dark, setDark] = useState(document.documentElement.classList.contains("dark"));
  const [open, setOpen] = useState(false);
  const integ = useQuery({ queryKey: ["integrations"], queryFn: () => api.get("/integrations"), refetchInterval: 60000 });
  useEffect(() => { document.documentElement.classList.toggle("dark", dark); try { localStorage.setItem("sml-theme", dark ? "dark" : "light"); } catch {} }, [dark]);
  const h = integ.data?.hindsight, l = integ.data?.llm;
  const hs = !h ? "checking" : h.reachable ? "live" : h.configured ? "error" : "off";
  return (
    <div className="flex min-h-full">
      <aside className={cx("fixed inset-y-0 left-0 z-40 w-64 shrink-0 overflow-y-auto border-r border-line bg-surface p-4 transition-transform lg:static lg:translate-x-0", open ? "translate-x-0" : "-translate-x-full")}>
        <div className="mb-6 flex items-center justify-between px-2">
          <div className="flex items-center gap-2.5"><div className="grid h-8 w-8 place-items-center rounded-lg bg-memory text-bg"><Brain className="h-5 w-5" /></div><div><p className="text-sm font-extrabold leading-4">Strategic Memory Lab</p><p className="text-[11px] text-muted">CloudDesk workspace</p></div></div>
          <button className="lg:hidden" aria-label="Close menu" onClick={() => setOpen(false)}><X className="h-5 w-5" /></button>
        </div>
        <nav className="space-y-5" aria-label="Main">
          {NAV.map((g) => (
            <div key={g.group}><p className="mb-1 px-2 text-[11px] font-semibold text-muted">{g.group}</p>
              {g.items.map((i) => (
                <NavLink key={i.to} to={i.to} end={(i as any).end} onClick={() => setOpen(false)} className={({ isActive }) => cx("flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm font-medium transition", isActive ? "bg-memory/15 text-memory" : "text-muted hover:bg-raised hover:text-ink")}>
                  <i.icon className="h-4 w-4" />{i.label}
                </NavLink>
              ))}
            </div>
          ))}
        </nav>
      </aside>
      {open && <div className="fixed inset-0 z-30 bg-black/50 lg:hidden" onClick={() => setOpen(false)} />}
      <div className="min-w-0 flex-1">
        <header className="sticky top-0 z-20 flex items-center justify-between gap-3 border-b border-line bg-bg/90 px-4 py-2.5 backdrop-blur lg:px-8">
          <button className="lg:hidden" aria-label="Open menu" onClick={() => setOpen(true)}><Menu className="h-5 w-5" /></button>
          <div className="ml-auto flex items-center gap-2">
            <NavLink to="/settings" className="flex items-center gap-1.5 rounded-lg border border-line bg-surface px-2.5 py-1.5 text-xs font-semibold" title={h?.detail}>
              <span className={cx("h-2 w-2 rounded-full", hs === "live" ? "bg-good" : hs === "error" ? "bg-bad" : "bg-warn")} />Hindsight: {hs === "live" ? "connected" : hs === "off" ? "not configured" : hs === "error" ? "unreachable" : "checking"}
            </NavLink>
            <span className="hidden items-center gap-1.5 rounded-lg border border-line bg-surface px-2.5 py-1.5 text-xs font-semibold sm:flex"><Scale className="h-3.5 w-3.5 text-muted" />Engine: {l?.mode === "llm" ? "LLM" : "rule-based"}</span>
            <button className="rounded-lg border border-line bg-surface p-2" aria-label="Toggle theme" onClick={() => setDark(!dark)}>{dark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}</button>
          </div>
        </header>
        <main className="mx-auto max-w-7xl px-4 py-6 lg:px-8"><Outlet /></main>
      </div>
    </div>
  );
}
