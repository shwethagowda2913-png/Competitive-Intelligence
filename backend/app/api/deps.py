from ..memory.hindsight_adapter import get_adapter  # noqa: F401
from ..db import get_db  # noqa: F401
from ..models import Decision, Event, RetainedItem
from ..schemas import DecisionOut, EventOut, OutcomeOut
from ..services.analytics import audit_decision
from sqlalchemy import select


def event_out(db, e: Event) -> EventOut:
    retained = db.scalar(select(RetainedItem.id).where(RetainedItem.kind == "event", RetainedItem.ref_id == e.id)) is not None
    o = EventOut.model_validate(e)
    o.competitor_name, o.retained = e.competitor.name, retained
    return o


def decision_out(d: Decision) -> DecisionOut:
    o = DecisionOut.model_validate(d)
    o.event_title, o.competitor_name, o.event_category = d.event.title, d.event.competitor.name, d.event.category
    o.audit = audit_decision(d)
    return o
