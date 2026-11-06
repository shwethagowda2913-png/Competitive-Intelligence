"""Dedicated Hindsight adapter. All retain/recall/reflect calls go through here and are logged to
memory_operations. When Hindsight is not configured, operations are logged as 'skipped' — never as success."""
import asyncio, logging, time
from dataclasses import dataclass, field
from datetime import datetime, date
from typing import Any

from sqlalchemy.orm import Session

from ..config import Settings, get_settings
from ..models import MemoryOperation

log = logging.getLogger("hindsight")

BANK_MISSION = (
    "You are the strategic memory of CloudDesk, a SaaS company. Remember competitor events, the company's "
    "decisions in response, the assumptions behind them, and the measured outcomes. Distinguish verified facts, "
    "human-approved decisions, measured outcomes and AI hypotheses. Synthetic demo data is labelled SIMULATED."
)


@dataclass
class OpResult:
    ok: bool
    status: str  # success | error | skipped
    data: Any = None
    error: str = ""
    op_id: int | None = None
    meta: dict = field(default_factory=dict)


def _fact(f) -> dict:
    g = (lambda k: getattr(f, k, None))
    return {"id": g("id"), "text": g("text"), "type": g("type"), "context": g("context"),
            "document_id": g("document_id"), "tags": g("tags") or []}


class HindsightAdapter:
    def __init__(self, settings: Settings | None = None, client: Any | None = None):
        self.s = settings or get_settings()
        self._client = client
        self._bank_ready = False

    @property
    def enabled(self) -> bool:
        return self._client is not None or self.s.hindsight_enabled

    @property
    def bank_id(self) -> str:
        return self.s.hindsight_bank_id

    def client(self):
        if self._client is None:
            from hindsight_client import Hindsight
            self._client = Hindsight(base_url=self.s.hindsight_base_url, api_key=self.s.hindsight_api_key or None,
                                     timeout=self.s.hindsight_timeout)
        return self._client

    async def _call(self, fn, *a, **kw):
        last = None
        for attempt in range(3):
            try:
                return await asyncio.wait_for(fn(*a, **kw), timeout=self.s.hindsight_timeout + 5)
            except Exception as e:  # noqa
                last = e
                status = getattr(e, "status", None)
                if status is not None and 400 <= int(status) < 500 and int(status) != 429:
                    break  # non-transient
                await asyncio.sleep(0.6 * (attempt + 1))
        raise last  # type: ignore

    def _log(self, db: Session, op: str, status: str, query="", rel_type="", rel_id=None, result=None, error="", ms=0) -> int:
        row = MemoryOperation(op_type=op, status=status, bank_id=self.bank_id, related_type=rel_type, related_id=rel_id,
                              query=query[:4000], result=result or {}, error=error[:2000], duration_ms=ms)
        db.add(row)
        db.commit()
        return row.id

    async def ensure_bank(self) -> None:
        if self._bank_ready:
            return
        await self._call(self.client().acreate_bank, self.bank_id, name="Strategic Memory Lab — CloudDesk",
                         mission=BANK_MISSION)
        self._bank_ready = True

    async def _run(self, db, op, query, rel_type, rel_id, summary, coro_factory, convert) -> OpResult:
        if not self.enabled:
            msg = "Hindsight is not configured (set HINDSIGHT_API_KEY). Operation skipped; no memory was written or read."
            oid = self._log(db, op, "skipped", query or summary, rel_type, rel_id, {}, msg)
            return OpResult(False, "skipped", None, msg, oid)
        t = time.time()
        try:
            try:
                await self.ensure_bank()
            except Exception as e:  # bank may already exist; real failures surface on the actual call
                log.info("ensure_bank: %s", e)
                self._bank_ready = True
            raw = await coro_factory()
            data = convert(raw)
            ms = int((time.time() - t) * 1000)
            oid = self._log(db, op, "success", query or summary, rel_type, rel_id, summary if isinstance(summary, dict) else {"summary": summary, **(data if isinstance(data, dict) else {})}, "", ms)
            return OpResult(True, "success", data, "", oid)
        except Exception as e:  # noqa
            ms = int((time.time() - t) * 1000)
            log.warning("hindsight %s failed: %s", op, e)
            oid = self._log(db, op, "error", query or str(summary), rel_type, rel_id, {}, f"{type(e).__name__}: {e}", ms)
            return OpResult(False, "error", None, f"{type(e).__name__}: {e}", oid)

    async def retain(self, db: Session, *, content: str, document_id: str, context: str, rel_type: str, rel_id: int,
                     timestamp: datetime | date | None = None, tags: list[str] | None = None) -> OpResult:
        ts = None
        if isinstance(timestamp, datetime):
            ts = timestamp
        elif isinstance(timestamp, date):
            ts = datetime(timestamp.year, timestamp.month, timestamp.day)
        summary = {"document_id": document_id, "context": context, "tags": tags or [], "chars": len(content),
                   "preview": content[:300]}

        def conv(r):
            return {"success": getattr(r, "success", None), "items_count": getattr(r, "items_count", None),
                    "operation_id": getattr(r, "operation_id", None), **summary}

        async def go():
            return await self.client().aretain(self.bank_id, content, timestamp=ts, context=context,
                                               document_id=document_id, tags=tags or None)
        return await self._run(db, "retain", document_id, rel_type, rel_id, summary, go, conv)

    async def recall(self, db: Session, *, query: str, rel_type: str = "", rel_id: int | None = None,
                     tags: list[str] | None = None, max_tokens: int = 2500) -> OpResult:
        def conv(r):
            items = [{**_fact(x), "score": (getattr(x, "scores", None) and getattr(x.scores, "model_dump", lambda: None)())}
                     for x in (r.results or [])]
            return {"count": len(items), "memories": items}

        async def go():
            return await self.client().arecall(self.bank_id, query, max_tokens=max_tokens, budget="mid",
                                               tags=tags or None, tags_match="any")
        return await self._run(db, "recall", query, rel_type, rel_id, query, go, conv)

    async def reflect(self, db: Session, *, query: str, context: str = "", rel_type: str = "", rel_id: int | None = None) -> OpResult:
        def conv(r):
            bo = getattr(r, "based_on", None)
            mem = [_fact(x) for x in (getattr(bo, "memories", None) or [])] if bo else []
            return {"text": r.text, "based_on": mem}

        async def go():
            return await self.client().areflect(self.bank_id, query, budget="mid", context=context or None,
                                                include_facts=True)
        return await self._run(db, "reflect", query, rel_type, rel_id, query, go, conv)

    async def health(self) -> dict:
        if not self.enabled:
            return {"configured": False, "reachable": False, "detail": "HINDSIGHT_API_KEY not set"}
        try:
            v = await asyncio.wait_for(self.client().aget_version(), timeout=10)
            return {"configured": True, "reachable": True, "detail": str(getattr(v, "api_version", v))}
        except Exception as e:  # noqa
            return {"configured": True, "reachable": False, "detail": f"{type(e).__name__}: {e}"[:300]}


_adapter: HindsightAdapter | None = None


def get_adapter() -> HindsightAdapter:
    global _adapter
    if _adapter is None:
        _adapter = HindsightAdapter()
    return _adapter


def set_adapter(a: HindsightAdapter | None):
    global _adapter
    _adapter = a
