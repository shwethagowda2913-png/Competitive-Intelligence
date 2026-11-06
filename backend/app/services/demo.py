"""Repeatable 4-step demonstration. All data is SIMULATED. Each step uses the same services as the normal app."""
from datetime import date, timedelta

from sqlalchemy import select
from sqlalchemy.orm import Session

from ..memory.hindsight_adapter import HindsightAdapter
from ..models import Competitor, Decision, Event, Outcome
from ..schemas import EventIn, SourceIn
from . import advisor, ingest
from .memory_sync import retain_decision, retain_event, retain_outcome

E1 = "RivalOne reduces Pro subscription price by 20%"
E2 = "NovaSuite launches lower-priced Starter plan"


def _get_event(db, title):
    return db.scalar(select(Event).where(Event.title == title))


def status(db: Session) -> dict:
    e1, e2 = _get_event(db, E1), _get_event(db, E2)
    d = db.scalar(select(Decision).where(Decision.event_id == e1.id)) if e1 else None
    return {"step1_event": e1.id if e1 else None, "step2_decision": d.id if d else None, "step3_outcome": bool(d and d.outcome),
            "step4_event": e2.id if e2 else None}


async def run_step(db: Session, ad: HindsightAdapter, n: int) -> dict:
    today = date.today()
    if n == 1:
        e = _get_event(db, E1)
        if not e:
            c = db.scalar(select(Competitor).where(Competitor.name == "RivalOne"))
            e = ingest.create_event(db, EventIn(competitor_id=c.id, category="pricing", title=E1, event_date=today - timedelta(days=3), verification_status="verified",
                                                description="RivalOne announced a 20% cut to its Pro subscription price to win small teams. [SIMULATED]",
                                                facts=["Reduction announced: 20%"], source=SourceIn(name="Simulated RivalOne announcement")), synthetic=True)
        r = await retain_event(db, ad, e)
        rec = await advisor.recommend(db, ad, e.id)
        return {"step": 1, "event_id": e.id, "retain": r.status if r else "already_retained", "recommendation": rec}
    if n == 2:
        e = _get_event(db, E1)
        if not e:
            raise ValueError("Run step 1 first")
        d = db.scalar(select(Decision).where(Decision.event_id == e.id))
        if not d:
            d = Decision(event_id=e.id, title="Broad 15% discount to new sign-ups [SIMULATED]", strategy_type="broad_discount",
                         decision="Offer a 15% discount on the Pro plan to all new customers for 6 months.", rationale="Match RivalOne quickly to protect acquisition.",
                         assumption="A broad discount will lift new-customer acquisition by at least 12% with no more than a 2-point margin loss.",
                         expected_result="Acquisition +12%, margin no worse than -2%.", expected_acquisition_pct=12.0, expected_margin_pct=-2.0, decided_on=today - timedelta(days=2), is_synthetic=True)
            db.add(d)
            db.commit()
        r = await retain_decision(db, ad, d)
        return {"step": 2, "decision_id": d.id, "retain": r.status if r else "already_retained"}
    if n == 3:
        e = _get_event(db, E1)
        d = db.scalar(select(Decision).where(Decision.event_id == e.id)) if e else None
        if not d:
            raise ValueError("Run step 2 first")
        if not d.outcome:
            db.add(Outcome(decision_id=d.id, actual_result="Customer acquisition rose 8% but profit margin fell 5 points after 60 days. [SIMULATED]", acquisition_change_pct=8.0,
                           margin_change_pct=-5.0, measurement_days=60, outcome_status="mixed", is_synthetic=True))
            db.commit()
            db.refresh(d)
        rs = await retain_outcome(db, ad, d)
        return {"step": 3, "decision_id": d.id, "retained": [x.status for x in rs] or ["already_retained"]}
    if n == 4:
        if not status(db)["step3_outcome"]:
            raise ValueError("Run step 3 first")
        e = _get_event(db, E2)
        if not e:
            c = db.scalar(select(Competitor).where(Competitor.name == "NovaSuite"))
            e = ingest.create_event(db, EventIn(competitor_id=c.id, category="pricing", title=E2, event_date=today, verification_status="verified",
                                                description="NovaSuite introduced a lower-priced Starter plan aimed at small teams. [SIMULATED]", facts=["New Starter plan below current entry price"],
                                                source=SourceIn(name="Simulated NovaSuite pricing page")), synthetic=True)
        await retain_event(db, ad, e)
        rec = await advisor.recommend(db, ad, e.id)
        return {"step": 4, "event_id": e.id, "recommendation": rec}
    raise ValueError("Unknown step")
