from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from ..ai.llm import get_llm
from ..config import get_settings
from ..memory.hindsight_adapter import get_adapter
from ..models import MemoryOperation, RetainedItem
from ..services import demo, memory_sync, seed
from .deps import get_db

router = APIRouter(prefix="/api", tags=["system"])


class QueryIn(BaseModel):
    query: str = Field(min_length=3, max_length=1000)


@router.get("/health")
def health():
    return {"status": "ok"}


@router.get("/integrations")
async def integrations(db: Session = Depends(get_db)):
    s, ad = get_settings(), get_adapter()
    h = await ad.health()
    return {"hindsight": {**h, "bank_id": s.hindsight_bank_id, "base_url": s.hindsight_base_url,
                          "retained_items": db.scalar(select(func.count(RetainedItem.id))) or 0},
            "llm": {"configured": get_llm() is not None, "provider": "groq", "model": s.llm_model, "fallback_model": s.llm_fallback_model,
                    "mode": "llm" if get_llm() else "rule_based"},
            "database": {"engine": "sqlite", "url_masked": s.database_url.split("///")[0] + "///…"}, "company": s.company_name}


@router.post("/memory/sync")
async def sync(db: Session = Depends(get_db)):
    return await memory_sync.sync_all(db, get_adapter())


@router.get("/memory/operations")
def ops(op_type: str | None = None, status: str | None = None, page: int = Query(1, ge=1), page_size: int = Query(50, ge=1, le=200), db: Session = Depends(get_db)):
    s = select(MemoryOperation)
    if op_type:
        s = s.where(MemoryOperation.op_type == op_type)
    if status:
        s = s.where(MemoryOperation.status == status)
    total = db.scalar(select(func.count()).select_from(s.subquery()))
    rows = db.scalars(s.order_by(MemoryOperation.id.desc()).offset((page - 1) * page_size).limit(page_size)).all()
    return {"items": [{"id": o.id, "op_type": o.op_type, "status": o.status, "bank_id": o.bank_id, "related_type": o.related_type, "related_id": o.related_id,
                       "query": o.query, "result": o.result, "error": o.error, "duration_ms": o.duration_ms, "created_at": o.created_at} for o in rows],
            "total": total, "page": page, "page_size": page_size}


@router.post("/memory/recall")
async def recall(body: QueryIn, db: Session = Depends(get_db)):
    r = await get_adapter().recall(db, query=body.query)
    return {"status": r.status, "error": r.error, "data": r.data}


@router.post("/memory/reflect")
async def reflect(body: QueryIn, db: Session = Depends(get_db)):
    r = await get_adapter().reflect(db, query=body.query)
    return {"status": r.status, "error": r.error, "data": r.data}


@router.get("/memory/history")
async def history(event_id: int, db: Session = Depends(get_db)):
    from ..models import Event
    e = db.get(Event, event_id)
    if not e:
        raise HTTPException(404, "Event not found")
    r = await get_adapter().recall(db, query=f"{e.competitor.name} {e.category.replace('_', ' ')}: {e.title}", rel_type="event", rel_id=e.id)
    return {"status": r.status, "error": r.error, "data": r.data}


@router.get("/demo/status")
def demo_status(db: Session = Depends(get_db)):
    return demo.status(db)


@router.post("/demo/reset")
def demo_reset(db: Session = Depends(get_db)):
    seed.clear_all(db)
    return seed.load_history(db)


@router.post("/demo/steps/{n}")
async def demo_step(n: int, db: Session = Depends(get_db)):
    try:
        return await demo.run_step(db, get_adapter(), n)
    except ValueError as e:
        raise HTTPException(422, str(e))
