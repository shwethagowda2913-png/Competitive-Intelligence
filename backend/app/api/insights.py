from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select
from sqlalchemy.orm import Session

from ..memory.hindsight_adapter import get_adapter
from ..models import MemoryOperation, Recommendation
from ..schemas import RecommendIn
from ..services import advisor, analytics
from .deps import get_db

router = APIRouter(prefix="/api", tags=["insights"])


@router.get("/dashboard")
def dashboard(db: Session = Depends(get_db)):
    return analytics.dashboard(db)


@router.get("/strategy-signals")
def signals(window_days: int = Query(240, ge=30, le=730), db: Session = Depends(get_db)):
    return {"items": analytics.strategy_signals(db, window_days)}


@router.get("/decision-dna")
def dna(db: Session = Depends(get_db)):
    return analytics.decision_dna(db)


@router.get("/assumption-audit")
def audit(db: Session = Depends(get_db)):
    return analytics.assumption_audit(db)


@router.get("/effectiveness")
def eff(db: Session = Depends(get_db)):
    return analytics.effectiveness(db)


@router.get("/counterfactual")
def cf(category: str = "pricing", db: Session = Depends(get_db)):
    return analytics.counterfactual(db, category)


@router.get("/health-warnings")
def warnings(db: Session = Depends(get_db)):
    return analytics.health_warnings(db)


@router.post("/recommendations", status_code=201)
async def recommend(body: RecommendIn, db: Session = Depends(get_db)):
    try:
        return await advisor.recommend(db, get_adapter(), body.event_id, body.use_hindsight)
    except LookupError:
        raise HTTPException(404, "Event not found")
    except ValueError as e:
        raise HTTPException(422, str(e))


@router.get("/recommendations")
def list_recs(event_id: int | None = None, limit: int = Query(30, ge=1, le=200), db: Session = Depends(get_db)):
    s = select(Recommendation).order_by(Recommendation.id.desc()).limit(limit)
    if event_id:
        s = s.where(Recommendation.event_id == event_id)
    return {"items": [{**r.payload, "id": r.id, "created_at": r.created_at.isoformat()} for r in db.scalars(s)]}


@router.get("/recommendations/{rid}")
def get_rec(rid: int, db: Session = Depends(get_db)):
    r = db.get(Recommendation, rid)
    if not r:
        raise HTTPException(404, "Recommendation not found")
    return {**r.payload, "id": r.id, "created_at": r.created_at.isoformat()}


@router.get("/memory-evolution")
def evo(db: Session = Depends(get_db)):
    return {"items": advisor.evolution(db)}
