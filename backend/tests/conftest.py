"""Test fixtures. FakeHindsightClient is a TEST DOUBLE used only here — the application never ships a fake memory."""
import os
os.environ["GROQ_API_KEY"] = ""
os.environ["HINDSIGHT_API_KEY"] = ""

import re
from types import SimpleNamespace as NS

import pytest
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app import db as dbmod
from app.ai import llm as llmmod
from app.config import Settings
from app.db import Base, SessionLocal, make_engine
from app.main import app
from app.memory.hindsight_adapter import HindsightAdapter, set_adapter
from app.services import seed


class FakeHindsightClient:
    """In-memory TEST DOUBLE of the Hindsight SDK surface we use."""
    def __init__(self, fail: bool = False):
        self.docs: dict[str, str] = {}
        self.fail = fail
        self.calls: list[str] = []

    async def acreate_bank(self, *a, **k):
        return NS()

    async def aget_version(self):
        return NS(api_version="test-double")

    async def aretain(self, bank_id, content, timestamp=None, context=None, document_id=None, tags=None, **k):
        self.calls.append("retain")
        if self.fail:
            raise RuntimeError("simulated hindsight outage")
        self.docs[document_id] = content
        return NS(success=True, items_count=1, operation_id=None)

    def _match(self, q):
        qw = set(re.findall(r"[a-z]{4,}", q.lower()))
        return [(d, t) for d, t in self.docs.items() if len(qw & set(re.findall(r"[a-z]{4,}", t.lower()))) >= 3]

    async def arecall(self, bank_id, query, **k):
        self.calls.append("recall")
        if self.fail:
            raise RuntimeError("simulated hindsight outage")
        res = [NS(id=d, text=t, type="world", context="", document_id=d, tags=[], scores=None) for d, t in self._match(query)]
        return NS(results=res)

    async def areflect(self, bank_id, query, context=None, **k):
        self.calls.append("reflect")
        if self.fail:
            raise RuntimeError("simulated hindsight outage")
        mem = [NS(id=d, text=t, type="world", context="", document_id=d, tags=[]) for d, t in self._match((context or "") + " " + query)]
        return NS(text=f"Reflection over {len(mem)} memories.", based_on=NS(memories=mem, mental_models=[], directives=[]))


@pytest.fixture()
def eng():
    e = make_engine("sqlite://")
    Base.metadata.create_all(e)
    SessionLocal.configure(bind=e)
    yield e
    e.dispose()


@pytest.fixture()
def db(eng):
    with SessionLocal() as s:
        yield s


@pytest.fixture()
def client(eng):
    set_adapter(HindsightAdapter(Settings(_env_file=None, hindsight_api_key="")))
    llmmod.set_llm(None)
    return TestClient(app, raise_server_exceptions=False)


@pytest.fixture()
def seeded(client, db):
    seed.load_history(db)
    return client


@pytest.fixture()
def fake_hs():
    fc = FakeHindsightClient()
    set_adapter(HindsightAdapter(Settings(_env_file=None, hindsight_api_key="test"), client=fc))
    yield fc
    set_adapter(None)
