"""Strategic AI Advisor: validate -> retrieve history (SQLite + Hindsight recall) -> reflect -> recommend -> persist."""
import logging
from datetime import date

from sqlalchemy import select
from sqlalchemy.orm import Session

from ..ai.llm import LLMError, get_llm
from ..memory.hindsight_adapter import HindsightAdapter
from ..models import Decision, Event, Recommendation
from ..schemas import AdvisorLLM, AltOption
from .analytics import STALE_DAYS, MIN_DAYS, audit_decision

log = logging.getLogger("advisor")
ALTS = {"pricing": ["targeted_discount", "feature_bundle", "no_response", "broad_discount"],
        "product_launch": ["feature_bundle", "no_response", "other"],
        "marketing": ["no_response", "other"], "hiring": ["no_response", "other"],
        "market_expansion": ["no_response", "other"], "other": ["no_response", "other"]}
NICE = lambda s: s.replace("_", " ")


def _pct(x):
    return "n/a" if x is None else f"{x:+.1f}%"


def validate_event(ev: Event) -> tuple[list[str], list[str]]:
    warnings, blockers = [], []
    if ev.verification_status == "unverified":
        warnings.append("The current event is unverified — confirm the source before committing to an expensive response")
    if ev.verification_status == "disputed":
        warnings.append("The current event is disputed — sources conflict")
    if ev.superseded_by_id:
        blockers.append(f"This event was superseded by event #{ev.superseded_by_id}; analyse the newer event instead")
    if not ev.sources:
        warnings.append("No source is recorded for this event")
    if ev.event_date and (date.today() - ev.event_date).days > STALE_DAYS:
        warnings.append(f"The event is older than {STALE_DAYS} days; the competitive context may have changed")
    return warnings, blockers


def gather_experiences(db: Session, ev: Event) -> list[dict]:
    """Past company decisions whose triggering event is relevant to this one (same category; unrelated categories are NOT evidence)."""
    out = []
    for d in db.scalars(select(Decision).join(Event, Decision.event_id == Event.id).where(Event.category == ev.category, Decision.event_id != ev.id, Decision.approved.is_(True))):
        o, pe = d.outcome, d.event
        reasons = [f"same category ({NICE(ev.category)})"]
        if pe.competitor_id == ev.competitor_id:
            reasons.append("same competitor")
        shared = set(pe.themes) & set(ev.themes)
        if shared:
            reasons.append("shared themes: " + ", ".join(sorted(shared)))
        a = audit_decision(d)
        age = (date.today() - pe.event_date).days if pe.event_date else None
        out.append({"decision_id": d.id, "title": d.title, "strategy_type": d.strategy_type, "decision": d.decision, "assumption": d.assumption,
                    "expected_result": d.expected_result, "trigger_event_id": pe.id, "trigger_event": pe.title, "trigger_competitor": pe.competitor.name,
                    "trigger_date": str(pe.event_date), "trigger_age_days": age, "is_synthetic": d.is_synthetic,
                    "outcome": None if not o or o.outcome_status == "pending" else {"status": o.outcome_status, "acquisition_change_pct": o.acquisition_change_pct,
                                                                                     "margin_change_pct": o.margin_change_pct, "measurement_days": o.measurement_days, "actual_result": o.actual_result},
                    "audit": {"verdict": a["verdict"], "explanation": a["explanation"], "warnings": a["warnings"]},
                    "relevance": reasons, "relevance_score": len(reasons) + (1 if o else 0)})
    out.sort(key=lambda x: -x["relevance_score"])
    return out


def competitor_history(db: Session, ev: Event, n: int = 6) -> list[dict]:
    rows = db.scalars(select(Event).where(Event.competitor_id == ev.competitor_id, Event.id != ev.id).order_by(Event.event_date.desc()).limit(n))
    return [{"id": e.id, "title": e.title, "category": e.category, "date": str(e.event_date), "verification_status": e.verification_status,
             "is_synthetic": e.is_synthetic, "superseded": e.superseded_by_id is not None} for e in rows]


def strength_label(measured: int) -> str:
    return {0: "none — no relevant measured history", 1: "limited — one relevant measured experience"}.get(measured, "moderate — several relevant measured experiences" if measured < 4 else "broader — many relevant measured experiences") + " (qualitative label, not a probability)"


def rule_engine(ev: Event, exps: list[dict]) -> AdvisorLLM:
    measured = [x for x in exps if x["outcome"]]
    alts = ALTS.get(ev.category, ["no_response", "other"])
    by = {}
    for x in measured:
        by.setdefault(x["strategy_type"], []).append(x)

    def negative(lst):
        return any(x["audit"]["verdict"] in ("failed", "mixed") or (x["outcome"]["margin_change_pct"] or 0) <= -3 for x in lst)

    def positive(lst):
        return all(x["audit"]["verdict"] == "supported" for x in lst)

    if not measured:
        missing = ["No recorded company decision with a measured outcome for similar events", "No recorded assumption to test against results",
                   "Segment-level exposure (which customers overlap with this competitor) is not recorded"]
        return AdvisorLLM(
            ai_interpretation=f"{ev.competitor.name}'s {NICE(ev.category)} move may pressure CloudDesk, but there is no recorded CloudDesk history to judge how similar moves played out.",
            recommended_strategy="other",
            recommended_action="Do not commit to a broad response yet. Confirm the event's source, size the exposure by customer segment, and run a small, reversible, measurable response (for example an offer limited to accounts that are demonstrably at risk) with a written assumption and a measurement window of at least 30 days.",
            rationale="With no relevant history the safest recommendation is cautious and designed to generate evidence: record the decision, the assumption and the result so future recommendations can use them.",
            alternatives=[AltOption(strategy=s, summary=f"{NICE(s).capitalize()}", trade_offs="No recorded CloudDesk experience with this option; trade-offs are untested.") for s in alts[:4]],
            uncertainty=["No historical experience available for this situation", "Competitor intent is inferred, not confirmed"],
            missing_evidence=missing, how_history_changed_it="Nothing yet — no relevant memory exists, so this is a cautious baseline.")
    bad = {s for s, l in by.items() if negative(l)}
    good = {s for s, l in by.items() if positive(l)}
    cite = lambda x: (f"Decision #{x['decision_id']}{' (SIMULATED)' if x['is_synthetic'] else ''}: {NICE(x['strategy_type'])} after {x['trigger_competitor']}'s \"{x['trigger_event']}\" — "
                      f"acquisition {_pct(x['outcome']['acquisition_change_pct'])}, margin {_pct(x['outcome']['margin_change_pct'])} over {x['outcome']['measurement_days'] or '?'} days; assumption \"{x['assumption']}\" was {x['audit']['verdict']}")
    if good:
        pick = sorted(good, key=lambda s: -len(by[s]))[0]
        action = f"Consider repeating a {NICE(pick)} approach, which met its recorded expectations before, while re-checking that today's conditions match."
        why = "Previously recorded outcome(s): " + " | ".join(cite(x) for x in by[pick])
    else:
        untried = [s for s in alts if s not in bad]
        pick = next((s for s in untried if s not in by), None) or (untried[0] if untried else "no_response")
        what_failed = " | ".join(cite(x) for s in bad for x in by[s])
        action = (f"Avoid defaulting to a {', '.join(NICE(s) for s in sorted(bad))} response. Evaluate a {NICE(pick)} instead, framed as a measured experiment with an explicit assumption "
                  f"(including an acceptable margin limit) and at least {MIN_DAYS} days of measurement.")
        why = "Recorded experience: " + what_failed
    others = [AltOption(strategy=s, summary=NICE(s).capitalize(),
                        trade_offs=("Recorded result was unfavourable: " + "; ".join(f"acq {_pct(x['outcome']['acquisition_change_pct'])}, margin {_pct(x['outcome']['margin_change_pct'])}" for x in by[s]))
                        if s in bad else ("Met expectations before" if s in good else "No recorded experience with this option")) for s in alts if s != pick]
    unc = ["History is a small sample and measured effects are correlational, not proven causes"]
    short = [x for x in measured if (x["outcome"]["measurement_days"] or 0) < MIN_DAYS]
    if short:
        unc.append(f"{len(short)} relevant outcome(s) have measurement periods under {MIN_DAYS} days")
    return AdvisorLLM(
        ai_interpretation=f"{ev.competitor.name}'s {NICE(ev.category)} event resembles {len(exps)} earlier situation(s) in which CloudDesk responded; {len(measured)} have measured results.",
        recommended_strategy=pick, recommended_action=action, rationale=why, alternatives=others, uncertainty=unc,
        missing_evidence=["Segment-level overlap with this competitor's customers", "Whether market conditions today match those of the earlier cases"] + (["Outcome data for decisions still pending"] if len(exps) > len(measured) else []),
        how_history_changed_it=f"Recommendation was shaped by {len(measured)} recorded outcome(s) instead of a generic first-time response: " + ("; ".join(f"decision #{x['decision_id']}" for x in measured)) + ".")


ADVISOR_SYSTEM = ("You are a strategy advisor for CloudDesk, a SaaS company. You are given a verified-or-flagged competitor event, structured historical "
                  "company decisions with recorded assumptions and measured outcomes (from the database), and memory retrieved from Hindsight. "
                  "Rules: use ONLY the evidence provided; never invent numbers, decisions or memory; do not claim causality — outcomes are correlations; "
                  "state uncertainty and missing evidence explicitly; if no relevant measured history exists, give a cautious evidence-gathering recommendation and say history is absent; "
                  "if history exists, explain concretely how it changes or qualifies the recommendation and cite decision ids. Simulated data must be called simulated. "
                  "Strategy must be one of: broad_discount, targeted_discount, feature_bundle, no_response, other.")


async def recommend(db: Session, ad: HindsightAdapter, event_id: int, use_hindsight: bool = True) -> dict:
    ev = db.get(Event, event_id)
    if not ev:
        raise LookupError("event not found")
    warnings, blockers = validate_event(ev)
    if blockers:
        raise ValueError("; ".join(blockers))
    exps = gather_experiences(db, ev)
    hist = competitor_history(db, ev)
    # --- Hindsight recall + reflect
    mem = {"status": "not_requested", "recall_count": 0, "memories": [], "reflect_text": "", "based_on": [], "errors": [], "operation_ids": []}
    if use_hindsight:
        q = f"{ev.competitor.name} {NICE(ev.category)}: {ev.title}. How did CloudDesk respond to similar competitor events, why, and what happened?"
        rc = await ad.recall(db, query=q, rel_type="event", rel_id=ev.id, tags=[f"category:{ev.category}"])
        rf = await ad.reflect(db, query="Given this new competitor event, which past CloudDesk decisions, assumptions and measured outcomes are relevant, and what do they suggest we should do differently?",
                              context=f"{ev.competitor.name} — {ev.title}. {ev.description}", rel_type="event", rel_id=ev.id)
        mem["operation_ids"] = [x.op_id for x in (rc, rf) if x.op_id]
        if rc.ok:
            mem["memories"], mem["recall_count"] = rc.data["memories"], rc.data["count"]
        elif rc.error:
            mem["errors"].append(f"recall: {rc.error}")
        if rf.ok:
            mem["reflect_text"], mem["based_on"] = rf.data["text"], rf.data["based_on"]
        elif rf.error:
            mem["errors"].append(f"reflect: {rf.error}")
        mem["status"] = "success" if (rc.ok and rf.ok) else "partial" if (rc.ok or rf.ok) else ("unconfigured" if rc.status == "skipped" else "error")
        if mem["status"] in ("unconfigured", "error", "partial"):
            warnings.append("Hindsight memory was unavailable or incomplete; this recommendation relies on structured history in the database only" if mem["status"] != "partial" else "Hindsight returned only part of the memory (see Memory Explorer)")
    surfaced = {m.get("document_id") for m in mem["memories"]} | {m.get("document_id") for m in mem["based_on"]}
    for x in exps:
        x["surfaced_by_hindsight"] = bool({f"decision-{x['decision_id']}", f"outcome-{x['decision_id']}", f"lesson-{x['decision_id']}"} & surfaced)
    # --- evidence-based warnings
    for x in exps:
        if x["trigger_age_days"] and x["trigger_age_days"] > STALE_DAYS:
            warnings.append(f"Evidence from decision #{x['decision_id']} is based on an event older than {STALE_DAYS} days")
        if x["outcome"] and (x["outcome"]["measurement_days"] or 0) < MIN_DAYS:
            warnings.append(f"Decision #{x['decision_id']} outcome has an insufficient measurement period")
    # --- generate
    engine, notes, result = "rule_based", [], None
    llm = get_llm()
    if llm:
        ctx = {"current_event": {"competitor": ev.competitor.name, "category": ev.category, "title": ev.title, "description": ev.description, "date": str(ev.event_date),
                                 "verification": ev.verification_status, "facts": ev.facts, "synthetic": ev.is_synthetic},
               "competitor_recent_history": hist, "past_decisions_from_database": exps[:8],
               "hindsight_recalled_memories": [m["text"] for m in mem["memories"][:10]], "hindsight_reflection": mem["reflect_text"][:3000]}
        import json
        try:
            result = await llm.complete_json(ADVISOR_SYSTEM, json.dumps(ctx, default=str)[:24000], AdvisorLLM)
            engine = "llm"
        except LLMError as e:
            notes.append(f"LLM generation failed ({e}); fell back to the rule-based engine, which uses the same recorded evidence.")
    else:
        notes.append("No LLM configured — rule-based engine used. It applies the recorded decisions and outcomes directly (no generative reasoning).")
    if result is None:
        result = rule_engine(ev, exps)
    measured = [x for x in exps if x["outcome"]]
    payload = {
        "event": {"id": ev.id, "title": ev.title, "competitor": ev.competitor.name, "category": ev.category, "date": str(ev.event_date),
                  "verification_status": ev.verification_status, "is_synthetic": ev.is_synthetic, "themes": ev.themes},
        "competitor_history": hist, "experiences": exps, "ai_interpretation": result.ai_interpretation,
        "recommended": {"strategy": result.recommended_strategy, "action": result.recommended_action, "rationale": result.rationale},
        "alternatives": [a.model_dump() for a in result.alternatives], "uncertainty": result.uncertainty, "missing_evidence": result.missing_evidence,
        "how_history_changed_it": result.how_history_changed_it, "evidence_strength": strength_label(len(measured)),
        "history_used": bool(measured), "influenced_by": [x["decision_id"] for x in measured],
        "memory": mem, "warnings": list(dict.fromkeys(warnings)), "engine": engine, "notes": notes,
    }
    row = Recommendation(event_id=ev.id, engine=engine, payload=payload)
    db.add(row)
    db.commit()
    payload["id"], payload["created_at"] = row.id, row.created_at.isoformat()
    return payload


def evolution(db: Session) -> list[dict]:
    from ..models import MemoryOperation
    recs = list(db.scalars(select(Recommendation).order_by(Recommendation.id)))
    out, last_by_cat = [], {}
    for r in recs:
        p = r.payload
        cat = p["event"]["category"]
        prev = last_by_cat.get(cat)
        used = set(p.get("influenced_by", []))
        entry = {"recommendation_id": r.id, "created_at": r.created_at.isoformat(), "event_id": r.event_id, "event_title": p["event"]["title"],
                 "competitor": p["event"]["competitor"], "category": cat, "engine": r.engine, "strategy": p["recommended"]["strategy"],
                 "action": p["recommended"]["action"], "history_used": p.get("history_used", False), "experiences_used": sorted(used),
                 "recalled_count": p.get("memory", {}).get("recall_count", 0), "memory_status": p.get("memory", {}).get("status"),
                 "how_history_changed_it": p.get("how_history_changed_it", ""), "is_synthetic": p["event"].get("is_synthetic", False)}
        if prev:
            pp = prev.payload
            entry["delta"] = {"previous_recommendation_id": prev.id, "previous_strategy": pp["recommended"]["strategy"],
                              "strategy_changed": pp["recommended"]["strategy"] != p["recommended"]["strategy"],
                              "new_experiences": sorted(used - set(pp.get("influenced_by", []))),
                              "previously_no_history": not pp.get("history_used", False)}
            ops = db.scalars(select(MemoryOperation).where(MemoryOperation.op_type == "retain", MemoryOperation.status == "success",
                                                           MemoryOperation.created_at > prev.created_at, MemoryOperation.created_at <= r.created_at))
            entry["delta"]["retained_since_previous"] = [o.query for o in ops]
        last_by_cat[cat] = r
        out.append(entry)
    return out
