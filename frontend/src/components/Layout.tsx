
import { NavLink, Outlet, useLocation } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import {
  Activity,
  ArrowUpRight,
  BarChart3,
  Brain,
  Building2,
  CalendarClock,
  CheckCircle2,
  ChevronRight,
  ClipboardCheck,
  Command,
  Dna,
  FileSearch,
  GitBranch,
  History,
  LayoutDashboard,
  Menu,
  Moon,
  Radar,
  Scale,
  Settings,
  ShieldCheck,
  Sun,
  X,
  Zap,
} from "lucide-react";
import { useEffect, useState } from "react";
import { api } from "../lib/api";
import { cx } from "./ui";

const NAV = [
  {
    group: "WORKSPACE",
    items: [
      { to: "/", label: "Overview", icon: LayoutDashboard, end: true },
    ],
  },
  {
    group: "INTELLIGENCE",
    items: [
      { to: "/competitors", label: "Competitor landscape", icon: Building2 },
      { to: "/events", label: "Market intelligence", icon: FileSearch },
      { to: "/timeline", label: "Competitive timeline", icon: CalendarClock },
      { to: "/signals", label: "Strategy signals", icon: Radar },
    ],
  },
  {
    group: "STRATEGY STUDIO",
    items: [
      { to: "/advisor", label: "AI strategy advisor", icon: Brain },
      { to: "/decisions", label: "Decisions & outcomes", icon: GitBranch },
    ],
  },
  {
    group: "ORGANIZATIONAL MEMORY",
    items: [
      { to: "/memory", label: "Memory explorer", icon: Activity },
      { to: "/dna", label: "Decision DNA", icon: Dna },
      { to: "/audit", label: "Assumption audit", icon: ClipboardCheck },
      { to: "/effectiveness", label: "Effectiveness", icon: BarChart3 },
      { to: "/evolution", label: "Memory evolution", icon: History },
    ],
  },
  {
    group: "CONFIGURATION",
    items: [
      { to: "/settings", label: "Settings & integrations", icon: Settings },
    ],
  },
];

export default function Layout() {
  const location = useLocation();

  const [dark, setDark] = useState(() => {
    try {
      const saved = localStorage.getItem("sml-theme");
      return saved ? saved === "dark" : document.documentElement.classList.contains("dark");
    } catch {
      return document.documentElement.classList.contains("dark");
    }
  });

  const [open, setOpen] = useState(false);

  const integ = useQuery({
    queryKey: ["integrations"],
    queryFn: () => api.get("/integrations"),
    refetchInterval: 60000,
  });

  useEffect(() => {
    document.documentElement.classList.toggle("dark", dark);

    try {
      localStorage.setItem("sml-theme", dark ? "dark" : "light");
    } catch {
      // Theme still works for this session if storage is unavailable.
    }
  }, [dark]);

  useEffect(() => {
    setOpen(false);
  }, [location.pathname]);

  const h = integ.data?.hindsight;
  const l = integ.data?.llm;

  const hs = !h
    ? "checking"
    : h.reachable
      ? "live"
      : h.configured
        ? "error"
        : "off";

  const navItems = NAV.flatMap((group) => group.items);

  const currentPage = navItems.find(
    (item) =>
      location.pathname === item.to ||
      (item.to !== "/" && location.pathname.startsWith(item.to + "/"))
  );

  const pageTitle =
    currentPage?.label ??
    (location.pathname.startsWith("/competitors/")
      ? "Competitor profile"
      : "Strategic workspace");

  const statusLabel = {
    live: "Connected",
    error: "Unreachable",
    off: "Not configured",
    checking: "Checking",
  }[hs];

  return (
    <div className="min-h-screen bg-bg text-ink">

      {/* MOBILE OVERLAY */}
      {open && (
        <button
          type="button"
          aria-label="Close navigation"
          className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm lg:hidden"
          onClick={() => setOpen(false)}
        />
      )}

      {/* SIDEBAR */}
      <aside
        className={cx(
          "fixed inset-y-0 left-0 z-50 flex w-[270px] flex-col",
          "border-r border-line bg-surface",
          "transition-transform duration-300",
          "lg:translate-x-0",
          open ? "translate-x-0" : "-translate-x-full"
        )}
      >

        {/* BRAND */}
        <div className="flex h-[76px] shrink-0 items-center justify-between border-b border-line px-5">

          <NavLink to="/" className="flex items-center gap-3">
            <div className="relative grid h-10 w-10 place-items-center overflow-hidden rounded-xl bg-gradient-to-br from-indigo-500 to-violet-600 text-white shadow-lg shadow-violet-500/20">
              <Brain className="h-5 w-5" />
              <span className="absolute -bottom-1 -right-1 h-4 w-4 rounded-full border-2 border-surface bg-cyan-400" />
            </div>

            <div>
              <p className="text-[15px] font-extrabold tracking-tight">
                Strategic<span className="text-memory">Memory</span>
              </p>
              <p className="mt-0.5 text-[9px] font-bold uppercase tracking-[0.17em] text-muted">
                Competitive intelligence
              </p>
            </div>
          </NavLink>

          <button
            type="button"
            className="rounded-lg p-2 text-muted hover:bg-raised lg:hidden"
            aria-label="Close menu"
            onClick={() => setOpen(false)}
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* WORKSPACE SELECTOR */}
        <div className="px-4 pb-3 pt-4">
          <div className="flex items-center gap-3 rounded-xl border border-line bg-raised/70 p-3">

            <div className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-brand/10 text-brand">
              <Command className="h-4 w-4" />
            </div>

            <div className="min-w-0 flex-1">
              <p className="text-xs font-bold">CloudDesk</p>
              <p className="mt-0.5 text-[10px] text-muted">
                Intelligence workspace
              </p>
            </div>

            <ChevronRight className="h-4 w-4 text-muted" />
          </div>
        </div>

        {/* NAVIGATION */}
        <nav
          className="min-h-0 flex-1 space-y-5 overflow-y-auto px-3 py-3"
          aria-label="Main navigation"
        >
          {NAV.map((group) => (
            <div key={group.group}>
              <p className="mb-2 px-3 text-[9px] font-bold tracking-[0.16em] text-muted/75">
                {group.group}
              </p>

              <div className="space-y-1">
                {group.items.map((item) => {
                  const Icon = item.icon;

                  return (
                    <NavLink
                      key={item.to}
                      to={item.to}
                      end={"end" in item ? item.end : false}
                      onClick={() => setOpen(false)}
                      className={({ isActive }) =>
                        cx(
                          "group relative flex items-center gap-3 rounded-lg px-3 py-2.5",
                          "text-[12px] font-semibold transition-all duration-200",
                          isActive
                            ? "bg-brand/10 text-brand"
                            : "text-muted hover:bg-raised hover:text-ink"
                        )
                      }
                    >
                      {({ isActive }) => (
                        <>
                          {isActive && (
                            <span className="absolute bottom-2 left-0 top-2 w-[3px] rounded-r-full bg-brand" />
                          )}

                          <Icon
                            className={cx(
                              "h-[17px] w-[17px] shrink-0 transition-colors",
                              isActive
                                ? "text-brand"
                                : "text-muted group-hover:text-ink"
                            )}
                          />

                          <span className="flex-1">{item.label}</span>

                          {isActive && (
                            <span className="h-1.5 w-1.5 rounded-full bg-brand" />
                          )}
                        </>
                      )}
                    </NavLink>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>

        {/* MEMORY STATUS */}
        <div className="shrink-0 border-t border-line p-4">

          <div className="innovation-surface rounded-xl p-3">
            <div className="flex items-center gap-2">
              <div className="grid h-7 w-7 place-items-center rounded-lg bg-memory/15 text-memory">
                <Zap className="h-4 w-4" />
              </div>

              <div className="flex-1">
                <p className="text-[11px] font-bold">Memory engine</p>
                <p className="text-[9px] text-muted">
                  Hindsight integration
                </p>
              </div>

              {hs === "live" ? (
                <CheckCircle2 className="h-4 w-4 text-good" />
              ) : (
                <span
                  className={cx(
                    "h-2 w-2 rounded-full",
                    hs === "error"
                      ? "bg-bad"
                      : hs === "off"
                        ? "bg-warn"
                        : "animate-pulse bg-warn"
                  )}
                />
              )}
            </div>

            <div className="mt-3 flex items-center justify-between border-t border-line/70 pt-2.5">
              <span className="text-[10px] text-muted">
                {statusLabel}
              </span>

              <NavLink
                to="/settings"
                className="flex items-center gap-1 text-[10px] font-semibold text-brand hover:underline"
              >
                Details
                <ArrowUpRight className="h-3 w-3" />
              </NavLink>
            </div>
          </div>

          <div className="mt-3 flex items-center gap-2 px-1">
            <ShieldCheck className="h-3.5 w-3.5 text-good" />
            <span className="text-[9px] text-muted">
              Strategic intelligence workspace
            </span>
          </div>
        </div>
      </aside>

      {/* MAIN APPLICATION */}
      <div className="min-h-screen lg:pl-[270px]">

        {/* TOP NAVIGATION */}
        <header className="sticky top-0 z-30 flex h-[68px] items-center justify-between gap-3 border-b border-line bg-bg/85 px-4 backdrop-blur-xl sm:px-6 lg:px-8">

          <div className="flex min-w-0 items-center gap-3">

            <button
              type="button"
              aria-label="Open navigation"
              onClick={() => setOpen(true)}
              className="rounded-lg border border-line bg-surface p-2 text-muted hover:text-ink lg:hidden"
            >
              <Menu className="h-4 w-4" />
            </button>

            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span className="hidden text-[10px] font-semibold text-muted sm:inline">
                  CLOUDDESK
                </span>
                <ChevronRight className="hidden h-3 w-3 text-muted sm:inline" />
                <h1 className="truncate text-sm font-bold tracking-tight">
                  {pageTitle}
                </h1>
              </div>

              <p className="mt-0.5 hidden text-[10px] text-muted sm:block">
                Intelligence that evolves with every decision.
              </p>
            </div>
          </div>

          {/* SYSTEM STATUS */}
          <div className="flex shrink-0 items-center gap-2">

            <NavLink
              to="/settings"
              title={h?.detail || "Hindsight connection status"}
              className="flex items-center gap-2 rounded-lg border border-line bg-surface px-2.5 py-2 text-[10px] font-semibold hover:border-memory/40 sm:px-3"
            >
              <span
                className={cx(
                  "h-1.5 w-1.5 rounded-full",
                  hs === "live"
                    ? "bg-good shadow-[0_0_8px_rgb(16_185_129_/_0.5)]"
                    : hs === "error"
                      ? "bg-bad"
                      : "bg-warn"
                )}
              />

              <span className="hidden sm:inline">Hindsight</span>
              <span className="text-muted">{statusLabel}</span>
            </NavLink>

            <div className="hidden items-center gap-2 rounded-lg border border-line bg-surface px-3 py-2 text-[10px] font-semibold sm:flex">
              <Scale className="h-3.5 w-3.5 text-memory" />
              <span>Engine</span>
              <span className="text-brand">
                {l?.mode === "llm" ? "LLM" : l?.mode ? "Rule-based" : "Checking"}
              </span>
            </div>

            <button
              type="button"
              aria-label="Toggle theme"
              title={dark ? "Switch to light mode" : "Switch to dark mode"}
              onClick={() => setDark((value) => !value)}
              className="rounded-lg border border-line bg-surface p-2.5 text-muted transition hover:border-brand/40 hover:text-brand"
            >
              {dark ? (
                <Sun className="h-4 w-4" />
              ) : (
                <Moon className="h-4 w-4" />
              )}
            </button>
          </div>
        </header>

        {/* PAGE CONTENT */}
        <main className="mx-auto w-full max-w-[1600px] px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
          <Outlet />
        </main>

      </div>
    </div>
  );
}
