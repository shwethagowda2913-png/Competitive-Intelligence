"""Live Hindsight check — run this with YOUR credentials in backend/.env:  python scripts/hindsight_smoke.py
Performs a real retain -> recall -> reflect round trip against the configured bank and prints the raw results.
(I could not run this in the build environment because no Hindsight credentials were available.)"""
import asyncio, sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from app.db import Base, SessionLocal, engine
from app.memory.hindsight_adapter import HindsightAdapter
from app import models  # noqa


async def main():
    Base.metadata.create_all(engine)
    ad = HindsightAdapter()
    print("health:", await ad.health())
    with SessionLocal() as db:
        r = await ad.retain(db, content="[SMOKE TEST] CloudDesk responded to a RivalOne 20% price cut with a broad discount; acquisition +8%, margin -5 points.",
                            document_id="smoke-1", context="smoke test", rel_type="smoke", rel_id=1, tags=["smoke"])
        print("retain:", r.status, r.error or r.data)
        await asyncio.sleep(8)  # retain extraction is asynchronous on the server
        c = await ad.recall(db, query="How did CloudDesk respond to a competitor price cut?")
        print("recall:", c.status, c.error or [m["text"][:100] for m in c.data["memories"]])
        f = await ad.reflect(db, query="What should CloudDesk do differently when a competitor cuts prices?")
        print("reflect:", f.status, f.error or f.data["text"][:400])

asyncio.run(main())
