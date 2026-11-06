"""Hindsight adapter behaviour using the FakeHindsightClient test double (see conftest)."""
from app.memory.hindsight_adapter import get_adapter
from app.models import MemoryOperation, RetainedItem


def test_retain_recall_reflect_logged_and_influence(seeded, fake_hs, db):
    s1 = seeded.post("/api/demo/steps/1").json()
    assert s1["retain"] == "success"
    seeded.post("/api/demo/steps/2")
    seeded.post("/api/demo/steps/3")
    rec = seeded.post("/api/demo/steps/4").json()["recommendation"]
    ops = {o.op_type: 0 for o in db.query(MemoryOperation)}
    for o in db.query(MemoryOperation):
        ops[o.op_type] += 1
        assert o.status == "success"
    assert ops["retain"] >= 4 and ops["recall"] >= 2 and ops["reflect"] >= 2
    assert rec["memory"]["status"] == "success" and rec["memory"]["recall_count"] >= 1
    assert any(x["surfaced_by_hindsight"] for x in rec["experiences"])
    assert any(m["document_id"].startswith(("decision-", "outcome-", "lesson-")) for m in rec["memory"]["memories"])
    # retain is idempotent: re-running does not re-write unchanged items
    n = len(fake_hs.docs)
    seeded.post("/api/memory/sync")
    seeded.post("/api/memory/sync")
    again = seeded.post("/api/memory/sync").json()
    assert again["attempted"] == 0 and len(fake_hs.docs) >= n


def test_unverified_events_not_retained(client, db, fake_hs):
    cid = client.post("/api/competitors", json={"name": "Z"}).json()["id"]
    e = client.post("/api/events", json={"competitor_id": cid, "category": "other", "title": "Rumour about Z", "verification_status": "unverified"}).json()
    assert e["retained"] is False and "retain" not in fake_hs.calls
    client.patch(f"/api/events/{e['id']}", json={"verification_status": "verified"})
    assert client.get(f"/api/events/{e['id']}").json()["retained"] is True


def test_hindsight_failure_is_logged_and_app_still_works(seeded, fake_hs, db):
    fake_hs.fail = True
    r = seeded.post("/api/demo/steps/1")
    assert r.status_code == 200 and r.json()["retain"] == "error"
    rec = r.json()["recommendation"]
    assert rec["memory"]["status"] == "error" and rec["memory"]["errors"]
    assert any("Hindsight" in w for w in rec["warnings"])
    statuses = {o.status for o in db.query(MemoryOperation)}
    assert statuses == {"error"}
    assert db.query(RetainedItem).count() == 0  # failures are never recorded as retained
    # direct adapter calls expose the error too
    j = seeded.post("/api/memory/recall", json={"query": "pricing event history"}).json()
    assert j["status"] == "error" and "outage" in j["error"]


def test_integrations_status(client, fake_hs):
    j = client.get("/api/integrations").json()
    assert j["hindsight"]["reachable"] is True and j["llm"]["mode"] == "rule_based"
