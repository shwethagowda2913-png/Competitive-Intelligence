from collections import Counter, defaultdict
from datetime import date, datetime, timedelta
from statistics import mean

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from ..models import Competitor, Decision, Event, MemoryOperation, Outcome, Recommendation
from .themes import percents

MIN_DAYS = 30
STALE_DAYS = 270


def _f(x):
    return "n/a" if x is None else f"{x:+.1f}%"


# ---------------------------------------------------------------- assumption audit
def audit_decision(d: Decision) -> dict:
    o = d.outcome
    base = {"decision_id": d.id, "checks": [], "warnings": [], "validated": False}
    if not o or o.outcome_status == "pending":
        return {**base, "verdict": "pending", "measurement_sufficient": False,
                "explanation": "No measured outcome recorded yet. This is missing evidence, not a failure.",
                "lesson": "", "warnings": ["Outcome not yet recorded"]}
    checks = []
    if d.expected_acquisition_pct is not None and o.acquisition_change_pct is not None:
        checks.append({"metric": "acquisition", "expected": d.expected_acquisition_pct, "actual": o.acquisition_change_pct,
                       "met": o.acquisition_change_pct >= d.expected_acquisition_pct})
    if d.expected_margin_pct is not None and o.margin_change_pct is not None:
        checks.append({"metric": "margin", "expected": d.expected_margin_pct, "actual": o.margin_change_pct,
                       "met": o.margin_change_pct >= d.expected_margin_pct})
    warnings = []
    sufficient = o.measurement_days is not None and o.measurement_days >= MIN_DAYS
    if not sufficient:
        warnings.append(f"Measurement period {'unknown' if o.measurement_days is None else str(o.measurement_days) + ' days'} is shorter than {MIN_DAYS} days — treat as provisional")
    if d.expected_margin_pct is None and o.margin_change_pct is not None and o.margin_change_pct <= -3:
        warnings.append(f"Margin moved {_f(o.margin_change_pct)} but the assumption set no margin expectation")
    if not checks:
        return {**base, "verdict": "unmeasured", "checks": [], "measurement_sufficient": sufficient, "warnings": warnings + ["No metric pair (expected vs actual) is available to test the assumption"],
                "explanation": "The assumption cannot be tested: expected and actual metrics are not both recorded.", "lesson": ""}
    met = [c for c in checks if c["met"]]
    verdict = "supported" if len(met) == len(checks) else "failed" if not met else "mixed"
    parts = [f"{c['metric']}: expected {_f(c['expected'])}, measured {_f(c['actual'])} ({'met' if c['met'] else 'not met'})" for c in checks]
    explanation = f"Assumption {verdict}. " + "; ".join(parts) + "."
    strat, cat = d.strategy_type.replace("_", " "), d.event.category.replace("_", " ")
    lesson = {
        "supported": f"A {strat} response to a competitor {cat} event met its recorded expectations ({'; '.join(parts)}).",
        "failed": f"A {strat} response to a competitor {cat} event did not meet its recorded expectations ({'; '.join(parts)}). Re-examine the assumption \"{d.assumption}\" before repeating it.",
        "mixed": f"A {strat} response to a competitor {cat} event partly met expectations ({'; '.join(parts)}). Trade-offs should be weighed before repeating it.",
    }[verdict]
    return {**base, "verdict": verdict, "checks": checks, "measurement_sufficient": sufficient, "warnings": warnings,
            "explanation": explanation, "lesson": lesson, "validated": sufficient}


def all_decisions(db: Session) -> list[Decision]:
    return list(db.scalars(select(Decision).order_by(Decision.decided_on.desc(), Decision.id.desc())))


def assumption_audit(db: Session) -> dict:
    items = []
    for d in all_decisions(db):
        a = audit_decision(d)
        items.append({"decision_id": d.id, "title": d.title, "strategy_type": d.strategy_type, "category": d.event.category,
                      "competitor": d.event.competitor.name, "assumption": d.assumption, "is_synthetic": d.is_synthetic, **{k: a[k] for k in ("verdict", "checks", "warnings", "explanation", "measurement_sufficient")}})
    c = Counter(i["verdict"] for i in items)
    grp = defaultdict(list)
    for i in items:
        if i["verdict"] in ("failed", "mixed"):
            grp[(i["category"], i["strategy_type"])].append(i["decision_id"])
    repeated = [{"category": k[0], "strategy_type": k[1], "decision_ids": v,
                 "note": f"{len(v)} decisions using '{k[1].replace('_', ' ')}' for {k[0].replace('_', ' ')} events failed or only partly met their assumptions."}
                for k, v in grp.items() if len(v) >= 2]
    missing = [i["decision_id"] for i in items if i["verdict"] in ("pending", "unmeasured")]
    return {"items": items, "counts": dict(c), "repeated_mistakes": repeated, "missing_evidence": missing}


# ---------------------------------------------------------------- decision DNA
def decision_dna(db: Session) -> dict:
    ds = all_decisions(db)
    by_strategy = Counter(d.strategy_type for d in ds)
    pair = defaultdict(list)
    for d in ds:
        pair[(d.event.category, d.strategy_type)].append(d)
    patterns = []
    for (cat, st), lst in pair.items():
        statuses = [d.outcome.outcome_status if d.outcome else "pending" for d in lst]
        patterns.append({"category": cat, "strategy_type": st, "count": len(lst), "statuses": dict(Counter(statuses)),
                         "decision_ids": [d.id for d in lst], "repeated": len(lst) >= 2,
                         "inconsistent": len({s for s in statuses if s != "pending"}) > 1})
    patterns.sort(key=lambda p: -p["count"])
    def brief(d):
        o = d.outcome
        return {"id": d.id, "title": d.title, "strategy_type": d.strategy_type, "category": d.event.category,
                "acquisition": o.acquisition_change_pct if o else None, "margin": o.margin_change_pct if o else None, "is_synthetic": d.is_synthetic}
    pos = [brief(d) for d in ds if d.outcome and d.outcome.outcome_status == "success"]
    neg = [brief(d) for d in ds if d.outcome and d.outcome.outcome_status == "failure"]
    mixed = [brief(d) for d in ds if d.outcome and d.outcome.outcome_status == "mixed"]
    total_events = db.scalar(select(func.count(Event.id))) or 0
    responded = db.scalar(select(func.count(func.distinct(Decision.event_id)))) or 0
    return {"total_decisions": len(ds), "by_strategy": dict(by_strategy), "patterns": patterns, "positive": pos, "negative": neg,
            "mixed": mixed, "pending": sum(1 for d in ds if not d.outcome or d.outcome.outcome_status == "pending"),
            "events_total": total_events, "events_responded": responded,
            "repeated_patterns": [p for p in patterns if p["repeated"]],
            "same_strategy_different_results": [p for p in patterns if p["inconsistent"]]}


# ---------------------------------------------------------------- effectiveness
def effectiveness(db: Session) -> dict:
    groups = defaultdict(list)
    for d in all_decisions(db):
        if d.outcome and d.outcome.outcome_status != "pending":
            groups[d.strategy_type].append(d)
    rows = []
    for st, lst in groups.items():
        acq = [d.outcome.acquisition_change_pct for d in lst if d.outcome.acquisition_change_pct is not None]
        mar = [d.outcome.margin_change_pct for d in lst if d.outcome.margin_change_pct is not None]
        days = [d.outcome.measurement_days for d in lst if d.outcome.measurement_days is not None]
        cav = []
        if len(lst) < 3:
            cav.append(f"Only {len(lst)} recorded outcome(s) — too few to generalise")
        if len(days) < len(lst):
            cav.append("Some outcomes have no measurement period")
        if days and max(days) > 2 * min(days):
            cav.append(f"Measurement periods differ ({min(days)}–{max(days)} days); averages are not like-for-like")
        if len(acq) != len(lst) or len(mar) != len(lst):
            cav.append("Not every outcome has both metrics; averages use available values only")
        rows.append({"strategy_type": st, "n": len(lst), "avg_acquisition_pct": round(mean(acq), 2) if acq else None, "n_acquisition": len(acq),
                     "avg_margin_pct": round(mean(mar), 2) if mar else None, "n_margin": len(mar),
                     "days_min": min(days) if days else None, "days_max": max(days) if days else None,
                     "statuses": dict(Counter(d.outcome.outcome_status for d in lst)), "caveats": cav,
                     "decision_ids": [d.id for d in lst], "is_synthetic": all(d.is_synthetic for d in lst)})
    rows.sort(key=lambda r: -r["n"])
    return {"strategies": rows, "disclaimer": "Associations between a response and later metrics. Other factors (seasonality, other launches, "
            "sales activity) are not controlled, so this does not show that a response caused the result."}


COUNTER_OPTIONS = [("broad_discount", "Broad discount", "Lower price for all customers/new sign-ups"),
                   ("targeted_discount", "Targeted discount", "Offer only to at-risk or high-intent segments"),
                   ("feature_bundle", "Feature bundle", "Bundle premium features at the current price"),
                   ("no_response", "No immediate response", "Monitor and measure before acting")]


def counterfactual(db: Session, category: str = "pricing") -> dict:
    eff = {r["strategy_type"]: r for r in effectiveness(db)["strategies"]}
    opts = []
    for key, name, desc in COUNTER_OPTIONS:
        r = eff.get(key)
        if not r:
            opts.append({"strategy_type": key, "name": name, "description": desc, "recorded_experience": 0,
                         "hypothetical_note": "No recorded CloudDesk experience with this option — any estimate would be speculation. Treat it as an untested experiment."})
        else:
            note = (f"Hypothetical: if the pattern recorded in {r['n']} past case(s) repeated, expect roughly acquisition {_f(r['avg_acquisition_pct'])} and "
                    f"margin {_f(r['avg_margin_pct'])}. Past results do not guarantee future results.")
            opts.append({"strategy_type": key, "name": name, "description": desc, "recorded_experience": r["n"],
                         "avg_acquisition_pct": r["avg_acquisition_pct"], "avg_margin_pct": r["avg_margin_pct"], "caveats": r["caveats"], "hypothetical_note": note})
    return {"label": "HYPOTHETICAL SCENARIOS — not predictions or guarantees", "category": category, "options": opts}


# ---------------------------------------------------------------- signal fusion
THEME_TEXT = {
    "ai": "a push toward AI-powered products", "enterprise": "a move up-market toward enterprise customers",
    "low_price": "aggressive price-led competition", "security_compliance": "building enterprise-grade trust and compliance",
    "international": "geographic expansion", "integrations": "ecosystem and integration strategy", "automation": "workflow automation positioning",
}


def strategy_signals(db: Session, window_days: int = 240) -> list[dict]:
    out = []
    for comp in db.scalars(select(Competitor)):
        evs = [e for e in comp.events if e.superseded_by_id is None and e.event_date]
        by_theme = defaultdict(list)
        for e in evs:
            for t in e.themes:
                by_theme[t].append(e)
        for theme, lst in by_theme.items():
            lst.sort(key=lambda e: e.event_date)
            # sliding window: best contiguous cluster
            best = []
            for i in range(len(lst)):
                cl = [x for x in lst[i:] if (x.event_date - lst[i].event_date).days <= window_days]
                if len(cl) > len(best):
                    best = cl
            cats = {e.category for e in best}
            if len(best) >= 3 and len(cats) >= 2:
                verified = sum(1 for e in best if e.verification_status == "verified")
                strength = "strong" if len(best) >= 5 and len(cats) >= 3 else "moderate" if len(best) >= 4 or len(cats) >= 3 else "emerging"
                out.append({"competitor_id": comp.id, "competitor": comp.name, "theme": theme, "status": "hypothesis", "strength": strength,
                            "hypothesis": f"{comp.name} may be signalling {THEME_TEXT.get(theme, theme)}.",
                            "reasoning": f"{len(best)} events across {len(cats)} categories ({', '.join(sorted(c.replace('_', ' ') for c in cats))}) between "
                                         f"{best[0].event_date} and {best[-1].event_date} share the '{theme.replace('_', ' ')}' theme. {verified} of {len(best)} are verified.",
                            "caveat": "This is an inference from public activity, not a confirmed competitor strategy.",
                            "evidence": [{"id": e.id, "title": e.title, "category": e.category, "date": str(e.event_date),
                                          "verification_status": e.verification_status, "is_synthetic": e.is_synthetic} for e in best],
                            "span_start": str(best[0].event_date), "span_end": str(best[-1].event_date)})
    rank = {"strong": 0, "moderate": 1, "emerging": 2}
    out.sort(key=lambda s: (rank[s["strength"]], -len(s["evidence"])))
    return out


# ---------------------------------------------------------------- staleness / contradictions
def health_warnings(db: Session) -> dict:
    today = date.today()
    evs = list(db.scalars(select(Event)))
    stale = [{"event_id": e.id, "title": e.title, "age_days": (today - e.event_date).days} for e in evs
             if e.event_date and (today - e.event_date).days > STALE_DAYS and e.superseded_by_id is None]
    superseded = [{"event_id": e.id, "title": e.title, "superseded_by": e.superseded_by_id} for e in evs if e.superseded_by_id]
    disputed = [{"event_id": e.id, "title": e.title} for e in evs if e.verification_status == "disputed"]
    conflicts = []
    live = [e for e in evs if e.superseded_by_id is None and e.event_date]
    for i, a in enumerate(live):
        for b in live[i + 1:]:
            if a.competitor_id != b.competitor_id or a.category != b.category or abs((a.event_date - b.event_date).days) > 45:
                continue
            pa, pb = percents(a.title + " " + a.description), percents(b.title + " " + b.description)
            if pa and pb and abs(pa[0] - pb[0]) >= 1 and (a.sources and b.sources and {s.name for s in a.sources} != {s.name for s in b.sources}):
                conflicts.append({"event_ids": [a.id, b.id], "competitor": a.competitor.name, "category": a.category,
                                  "detail": f"Sources report different figures ({pa[0]}% vs {pb[0]}%) for similar {a.category.replace('_', ' ')} events within 45 days. Verify before relying on either."})
    short = [{"decision_id": d.id, "title": d.title, "days": d.outcome.measurement_days} for d in all_decisions(db)
             if d.outcome and d.outcome.outcome_status != "pending" and (d.outcome.measurement_days is None or d.outcome.measurement_days < MIN_DAYS)]
    stale_recs = []
    for r in db.scalars(select(Recommendation).order_by(Recommendation.id.desc()).limit(50)):
        w = [x for x in r.payload.get("warnings", []) if "older than" in x or "superseded" in x.lower()]
        if w:
            stale_recs.append({"recommendation_id": r.id, "event_id": r.event_id, "warnings": w})
    return {"stale_events": stale, "superseded_events": superseded, "disputed_events": disputed, "conflicts": conflicts,
            "short_measurement": short, "recommendations_with_old_evidence": stale_recs,
            "total": len(stale) + len(superseded) + len(disputed) + len(conflicts) + len(short) + len(stale_recs)}


# ---------------------------------------------------------------- dashboard
def dashboard(db: Session) -> dict:
    ev = list(db.scalars(select(Event)))
    by_month = defaultdict(lambda: Counter())
    for e in ev:
        if e.event_date:
            by_month[e.event_date.strftime("%Y-%m")][e.category] += 1
    months = [{"month": m, **dict(c)} for m, c in sorted(by_month.items())]
    ops = db.execute(select(MemoryOperation.op_type, MemoryOperation.status, func.count()).group_by(MemoryOperation.op_type, MemoryOperation.status)).all()
    ds = all_decisions(db)
    return {
        "counts": {"competitors": db.scalar(select(func.count(Competitor.id))) or 0, "events": len(ev), "decisions": len(ds),
                   "outcomes_measured": sum(1 for d in ds if d.outcome and d.outcome.outcome_status != "pending"),
                   "recommendations": db.scalar(select(func.count(Recommendation.id))) or 0,
                   "unverified_events": sum(1 for e in ev if e.verification_status != "verified")},
        "events_by_month": months,
        "events_by_competitor": [{"name": c.name, "count": len(c.events)} for c in db.scalars(select(Competitor))],
        "events_by_category": dict(Counter(e.category for e in ev)),
        "memory_ops": [{"op": o, "status": s, "count": n} for o, s, n in ops],
        "signals": strategy_signals(db)[:3],
        "warnings_total": health_warnings(db)["total"],
        "recent_events": [{"id": e.id, "title": e.title, "competitor": e.competitor.name, "category": e.category, "date": str(e.event_date), "is_synthetic": e.is_synthetic}
                          for e in sorted([x for x in ev if x.event_date], key=lambda x: x.event_date, reverse=True)[:6]],
    }
