import { lazy, Suspense } from "react";
import { Route, Routes } from "react-router-dom";
import Layout from "./components/Layout";
import { PageSkeleton } from "./components/ui";

const Overview = lazy(() => import("./pages/Overview"));
const Competitors = lazy(() => import("./pages/Competitors"));
const CompetitorDetail = lazy(() => import("./pages/Competitors").then((m) => ({ default: m.CompetitorDetail })));
const Events = lazy(() => import("./pages/Events"));
const Timeline = lazy(() => import("./pages/Timeline"));
const Signals = lazy(() => import("./pages/Signals"));
const Advisor = lazy(() => import("./pages/Advisor"));
const Decisions = lazy(() => import("./pages/Decisions"));
const DecisionDNA = lazy(() => import("./pages/Learn").then((m) => ({ default: m.DecisionDNA })));
const Audit = lazy(() => import("./pages/Learn").then((m) => ({ default: m.Audit })));
const Effectiveness = lazy(() => import("./pages/Learn").then((m) => ({ default: m.Effectiveness })));
const Evolution = lazy(() => import("./pages/Evolution"));
const MemoryExplorer = lazy(() => import("./pages/MemoryExplorer"));
const SettingsPage = lazy(() => import("./pages/Settings"));

export default function App() {
  return (
    <Suspense fallback={<div className="p-8"><PageSkeleton /></div>}>
      <Routes>
        <Route element={<Layout />}>
          <Route index element={<Overview />} />
          <Route path="competitors" element={<Competitors />} />
          <Route path="competitors/:id" element={<CompetitorDetail />} />
          <Route path="events" element={<Events />} />
          <Route path="timeline" element={<Timeline />} />
          <Route path="signals" element={<Signals />} />
          <Route path="advisor" element={<Advisor />} />
          <Route path="decisions" element={<Decisions />} />
          <Route path="dna" element={<DecisionDNA />} />
          <Route path="audit" element={<Audit />} />
          <Route path="effectiveness" element={<Effectiveness />} />
          <Route path="evolution" element={<Evolution />} />
          <Route path="memory" element={<MemoryExplorer />} />
          <Route path="settings" element={<SettingsPage />} />
          <Route path="*" element={<div className="py-20 text-center text-muted">Page not found.</div>} />
        </Route>
      </Routes>
    </Suspense>
  );
}
