"""Retains structured SQLite records into Hindsight (idempotent via document_id + content hash)."""
import hashlib

from sqlalchemy import select
from sqlalchemy.orm import Session

from ..memory.hindsight_adapter import HindsightAdapter, OpResult
from ..models import Decision, Event, Outcome, RetainedItem
from .analytics import audit_decision

SIM = "SIMULATED DEMO DATA — not real-world evidence. "


def event_text(e: Event) -> str:
    src = "; ".join(f"{s.name} {s.url or ''}".strip() for s in e.sources) or "no source recorded"
    return (f"{SIM if e.is_synthetic else ''}[COMPETITOR EVENT #{e.id}] {e.competitor.name} — {e.category.replace('_', ' ')}: {e.title}. "
            f"Date: {e.event_date or 'unknown'}. Verification: {e.verification_status}. Details: {e.description} "
            f"Facts: {'; '.join(e.facts) or 'none stated'}. Themes: {', '.join(e.themes) or 'none'}. Source: {src}.")


def decision_text(d: Decision) -> str:
    ev = d.event
    return (f"{SIM if d.is_synthetic else ''}[COMPANY DECISION #{d.id}] In response to {ev.competitor.name}'s {ev.category.replace('_', ' ')} "
            f"event \"{ev.title}\" (event #{ev.id}), CloudDesk decided: {d.title} (strategy: {d.strategy_type.replace('_', ' ')}). "
            f"Action: {d.decision} Rationale: {d.rationale or 'not recorded'}. Assumption: {d.assumption or 'not recorded'}. "
            f"Expected result: {d.expected_result or 'not recorded'}. Expected acquisition change: {d.expected_acquisition_pct}%. "
            f"Expected margin change: {d.expected_margin_pct}%. Decided on {d.decided_on}.")


def outcome_text(d: Decision, o: Outcome, a: dict) -> str:
    ev = d.event
    return (f"{SIM if o.is_synthetic else ''}[MEASURED OUTCOME for decision #{d.id}] After CloudDesk's {d.strategy_type.replace('_', ' ')} "
            f"response to {ev.competitor.name}'s {ev.category.replace('_', ' ')} event \"{ev.title}\": {o.actual_result or 'no narrative'} "
            f"Measured acquisition change: {o.acquisition_change_pct}%. Measured margin change: {o.margin_change_pct}%. "
            f"Measurement period: {o.measurement_days} days. Outcome status: {o.outcome_status}. "
            f"Original assumption: \"{d.assumption}\". Assumption audit: {a['verdict']} — {a['explanation']}")


def lesson_text(d: Decision, a: dict) -> str:
    return (f"{SIM if d.is_synthetic else ''}[VALIDATED LESSON from decision #{d.id}] {a['lesson']} "
            f"(strategy: {d.strategy_type.replace('_', ' ')}; event category: {d.event.category.replace('_', ' ')}; assumption verdict: {a['verdict']}).")


def _tags(e: Event, extra: list[str]) -> list[str]:
    return [f"competitor:{e.competitor.name.lower()}", f"category:{e.category}", *extra]


async def _retain_once(db: Session, ad: HindsightAdapter, kind: str, ref_id: int, doc_id: str, text: str, ctx: str, ts, tags) -> OpResult | None:
    h = hashlib.sha256(text.encode()).hexdigest()
    row = db.scalar(select(RetainedItem).where(RetainedItem.kind == kind, RetainedItem.ref_id == ref_id))
    if row and row.content_hash == h:
        return None  # already retained, unchanged
    res = await ad.retain(db, content=text, document_id=doc_id, context=ctx, rel_type=kind, rel_id=ref_id, timestamp=ts, tags=tags)
    if res.ok:
        if row:
            row.content_hash = h
        else:
            db.add(RetainedItem(kind=kind, ref_id=ref_id, document_id=doc_id, content_hash=h))
        db.commit()
    return res


async def retain_event(db: Session, ad: HindsightAdapter, e: Event) -> OpResult | None:
    if e.verification_status != "verified":
        return None  # only verified events are retained
    return await _retain_once(db, ad, "event", e.id, f"event-{e.id}", event_text(e), "competitor intelligence event", e.event_date, _tags(e, ["event"]))


async def retain_decision(db: Session, ad: HindsightAdapter, d: Decision) -> OpResult | None:
    if not d.approved:
        return None
    return await _retain_once(db, ad, "decision", d.id, f"decision-{d.id}", decision_text(d), "approved company decision with assumption",
                              d.decided_on, _tags(d.event, ["decision", f"strategy:{d.strategy_type}"]))


async def retain_outcome(db: Session, ad: HindsightAdapter, d: Decision) -> list[OpResult]:
    o = d.outcome
    if not o or o.outcome_status == "pending":
        return []
    a = audit_decision(d)
    out = []
    r = await _retain_once(db, ad, "outcome", d.id, f"outcome-{d.id}", outcome_text(d, o, a), "measured decision outcome and assumption audit",
                           o.recorded_at, _tags(d.event, ["outcome", f"strategy:{d.strategy_type}", f"verdict:{a['verdict']}"]))
    if r:
        out.append(r)
    if a["validated"]:
        r2 = await _retain_once(db, ad, "lesson", d.id, f"lesson-{d.id}", lesson_text(d, a), "validated lesson learned",
                                o.recorded_at, _tags(d.event, ["lesson", f"strategy:{d.strategy_type}"]))
        if r2:
            out.append(r2)
    return out


async def sync_all(db: Session, ad: HindsightAdapter) -> dict:
    stats = {"attempted": 0, "succeeded": 0, "failed": 0, "skipped_unconfigured": 0}

    def tally(r):
        if r is None:
            return
        stats["attempted"] += 1
        if r.ok:
            stats["succeeded"] += 1
        elif r.status == "skipped":
            stats["skipped_unconfigured"] += 1
        else:
            stats["failed"] += 1
    for e in db.scalars(select(Event).order_by(Event.event_date)):
        tally(await retain_event(db, ad, e))
    for d in db.scalars(select(Decision).order_by(Decision.id)):
        tally(await retain_decision(db, ad, d))
        for r in await retain_outcome(db, ad, d):
            tally(r)
    return stats
