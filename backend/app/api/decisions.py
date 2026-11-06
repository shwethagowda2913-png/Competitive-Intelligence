import logging
from datetime import date

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from ..memory.hindsight_adapter import get_adapter
from ..models import Decision, Event, Outcome
from ..schemas import DecisionIn, OutcomeIn
from ..services.memory_sync import retain_decision, retain_outcome
from .deps import decision_out, get_db

log = logging.getLogger("decisions")
router = APIRouter(prefix="/api", tags=["decisions"])


@router.get("/decisions")
def list_decisions(event_id: int | None = None, strategy_type: str | None = None, page: int = Query(1, ge=1), page_size: int = Query(50, ge=1, le=200), db: Session = Depends(get_db)):
    s = select(Decision)
    if event_id:
        s = s.where(Decision.event_id == event_id)
    if strategy_type:
        s = s.where(Decision.strategy_type == strategy_type)
    total = db.scalar(select(func.count()).select_from(s.subquery()))
    rows = db.scalars(s.order_by(Decision.decided_on.desc(), Decision.id.desc()).offset((page - 1) * page_size).limit(page_size)).all()
    return {"items": [decision_out(d) for d in rows], "total": total, "page": page, "page_size": page_size}


@router.post("/decisions", status_code=201)
async def create_decision(body: DecisionIn, db: Session = Depends(get_db)):
    if not db.get(Event, body.event_id):
        raise HTTPException(404, "Event not found")
    data = body.model_dump()
    data["decided_on"] = data["decided_on"] or date.today()
    d = Decision(**data)
    db.add(d)
    db.commit()
    try:
        await retain_decision(db, get_adapter(), d)
    except Exception:  # noqa
        log.exception("retain decision failed")
    return decision_out(d)


@router.get("/decisions/{did}")
def get_decision(did: int, db: Session = Depends(get_db)):
    d = db.get(Decision, did)
    if not d:
        raise HTTPException(404, "Decision not found")
    return decision_out(d)


@router.delete("/decisions/{did}", status_code=204)
def delete_decision(did: int, db: Session = Depends(get_db)):
    d = db.get(Decision, did)
    if not d:
        raise HTTPException(404, "Decision not found")
    db.delete(d)
    db.commit()


@router.post("/outcomes", status_code=201)
async def record_outcome(body: OutcomeIn, db: Session = Depends(get_db)):
    d = db.get(Decision, body.decision_id)
    if not d:
        raise HTTPException(404, "Decision not found")
    if body.outcome_status != "pending" and body.acquisition_change_pct is None and body.margin_change_pct is None and not body.actual_result.strip():
        raise HTTPException(422, "Record at least one metric or a written result, or leave the status as pending")
    o = d.outcome or Outcome(decision_id=d.id)
    for k, v in body.model_dump(exclude={"decision_id"}).items():
        setattr(o, k, v)
    o.is_synthetic = d.is_synthetic
    db.add(o)
    db.commit()
    db.refresh(d)
    try:
        await retain_outcome(db, get_adapter(), d)
    except Exception:  # noqa
        log.exception("retain outcome failed")
    return decision_out(d)
