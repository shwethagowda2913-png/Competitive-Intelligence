import logging
from datetime import date

from pydantic import BaseModel, Field
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import func, or_, select
from sqlalchemy.orm import Session

from ..memory.hindsight_adapter import get_adapter
from ..models import Event, EventSource
from ..schemas import AnalyzeIn, AnalyzeOut, EventIn, EventPatch
from ..services import ingest
from ..services.memory_sync import retain_event
from .deps import event_out, get_db

log = logging.getLogger("events")
router = APIRouter(prefix="/api", tags=["events"])


@router.get("/events")
def list_events(competitor_id: int | None = None, category: str | None = None, verification: str | None = None, q: str = "",
                date_from: date | None = None, date_to: date | None = None, page: int = Query(1, ge=1), page_size: int = Query(50, ge=1, le=500),
                order: str = "desc", db: Session = Depends(get_db)):
    s = select(Event)
    if competitor_id:
        s = s.where(Event.competitor_id == competitor_id)
    if category:
        s = s.where(Event.category == category)
    if verification:
        s = s.where(Event.verification_status == verification)
    if date_from:
        s = s.where(Event.event_date >= date_from)
    if date_to:
        s = s.where(Event.event_date <= date_to)
    if q:
        s = s.where(or_(Event.title.ilike(f"%{q}%"), Event.description.ilike(f"%{q}%")))
    total = db.scalar(select(func.count()).select_from(s.subquery()))
    col = Event.event_date.desc() if order == "desc" else Event.event_date.asc()
    rows = db.scalars(s.order_by(col, Event.id.desc()).offset((page - 1) * page_size).limit(page_size)).all()
    return {"items": [event_out(db, e) for e in rows], "total": total, "page": page, "page_size": page_size}


@router.post("/events", status_code=201)
async def create_event(body: EventIn, db: Session = Depends(get_db)):
    try:
        ev = ingest.create_event(db, body)
    except LookupError:
        raise HTTPException(404, "Competitor not found")
    except ingest.Duplicate as d:
        raise HTTPException(409, detail={"message": "This event already exists", "existing_event_id": d.event_id})
    try:
        await retain_event(db, get_adapter(), ev)
    except Exception:  # noqa
        log.exception("retain after create failed")
    return event_out(db, ev)


@router.get("/events/{eid}")
def get_event(eid: int, db: Session = Depends(get_db)):
    e = db.get(Event, eid)
    if not e:
        raise HTTPException(404, "Event not found")
    return event_out(db, e)


@router.patch("/events/{eid}")
async def patch_event(eid: int, body: EventPatch, db: Session = Depends(get_db)):
    e = db.get(Event, eid)
    if not e:
        raise HTTPException(404, "Event not found")
    data = body.model_dump(exclude_unset=True)
    if data.get("superseded_by_id") is not None:
        n = db.get(Event, data["superseded_by_id"])
        if not n or n.id == e.id or n.competitor_id != e.competitor_id:
            raise HTTPException(422, "superseded_by_id must be another event of the same competitor")
    for k, v in data.items():
        setattr(e, k, v)
    db.commit()
    try:
        await retain_event(db, get_adapter(), e)
    except Exception:  # noqa
        log.exception("retain after patch failed")
    return event_out(db, e)


@router.delete("/events/{eid}", status_code=204)
def delete_event(eid: int, db: Session = Depends(get_db)):
    e = db.get(Event, eid)
    if not e:
        raise HTTPException(404, "Event not found")
    db.delete(e)
    db.commit()


@router.post("/events/analyze", response_model=AnalyzeOut)
async def analyze(body: AnalyzeIn, db: Session = Depends(get_db)):
    try:
        return await ingest.analyze(db, body)
    except ValueError as e:
        raise HTTPException(422, str(e))


class RssIn(BaseModel):
    competitor_id: int
    url: str = Field(max_length=1000)
    limit: int = Field(default=10, ge=1, le=30)


@router.post("/events/rss-preview")
async def rss_preview(body: RssIn, db: Session = Depends(get_db)):
    try:
        return {"items": await ingest.rss_preview(db, body.competitor_id, body.url, body.limit)}
    except LookupError:
        raise HTTPException(404, "Competitor not found")
    except ValueError as e:
        raise HTTPException(422, str(e))


@router.get("/sources")
def sources(page: int = Query(1, ge=1), page_size: int = Query(100, ge=1, le=500), db: Session = Depends(get_db)):
    total = db.scalar(select(func.count(EventSource.id)))
    rows = db.scalars(select(EventSource).order_by(EventSource.id.desc()).offset((page - 1) * page_size).limit(page_size)).all()
    return {"items": [{"id": s.id, "event_id": s.event_id, "event_title": s.event.title, "name": s.name, "url": s.url, "fetched_at": s.fetched_at} for s in rows],
            "total": total, "page": page, "page_size": page_size}
