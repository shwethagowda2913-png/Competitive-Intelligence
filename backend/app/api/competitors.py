from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import func, or_, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from ..models import Competitor
from ..schemas import CompetitorIn, CompetitorOut
from .deps import event_out, get_db

router = APIRouter(prefix="/api/competitors", tags=["competitors"])


def _out(c: Competitor) -> CompetitorOut:
    o = CompetitorOut.model_validate(c)
    o.event_count = len(c.events)
    return o


@router.get("")
def list_competitors(q: str = "", industry: str = "", page: int = Query(1, ge=1), page_size: int = Query(50, ge=1, le=200), db: Session = Depends(get_db)):
    stmt = select(Competitor)
    if q:
        stmt = stmt.where(or_(Competitor.name.ilike(f"%{q}%"), Competitor.description.ilike(f"%{q}%")))
    if industry:
        stmt = stmt.where(Competitor.industry.ilike(f"%{industry}%"))
    total = db.scalar(select(func.count()).select_from(stmt.subquery()))
    rows = db.scalars(stmt.order_by(Competitor.name).offset((page - 1) * page_size).limit(page_size)).all()
    return {"items": [_out(c) for c in rows], "total": total, "page": page, "page_size": page_size}


@router.post("", status_code=201, response_model=CompetitorOut)
def create(body: CompetitorIn, db: Session = Depends(get_db)):
    c = Competitor(**body.model_dump())
    db.add(c)
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(409, "A competitor with this name already exists")
    return _out(c)


@router.get("/{cid}")
def get(cid: int, db: Session = Depends(get_db)):
    c = db.get(Competitor, cid)
    if not c:
        raise HTTPException(404, "Competitor not found")
    evs = sorted(c.events, key=lambda e: (e.event_date is None, e.event_date), reverse=True)
    return {**_out(c).model_dump(mode="json"), "events": [event_out(db, e).model_dump(mode="json") for e in evs]}


@router.put("/{cid}", response_model=CompetitorOut)
def update(cid: int, body: CompetitorIn, db: Session = Depends(get_db)):
    c = db.get(Competitor, cid)
    if not c:
        raise HTTPException(404, "Competitor not found")
    for k, v in body.model_dump().items():
        setattr(c, k, v)
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(409, "A competitor with this name already exists")
    return _out(c)


@router.delete("/{cid}", status_code=204)
def delete(cid: int, db: Session = Depends(get_db)):
    c = db.get(Competitor, cid)
    if not c:
        raise HTTPException(404, "Competitor not found")
    db.delete(c)
    db.commit()
