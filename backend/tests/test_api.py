import json
import httpx
import pytest

from app.ai.llm import GroqProvider, LLMError, set_llm
from app.config import Settings
from app.schemas import AdvisorLLM, ClassificationLLM
from app.services import urlsafe


def mk_comp(client, name="Acme"):
    return client.post("/api/competitors", json={"name": name, "industry": "SaaS", "website": "https://x.example"})


def test_competitor_crud(client):
    r = mk_comp(client)
    assert r.status_code == 201
    cid = r.json()["id"]
    assert mk_comp(client).status_code == 409
    assert client.put(f"/api/competitors/{cid}", json={"name": "Acme2", "industry": "SaaS"}).json()["name"] == "Acme2"
    assert client.get("/api/competitors?q=acme").json()["total"] == 1
    assert client.post("/api/competitors", json={"name": "  "}).status_code == 422
    assert client.delete(f"/api/competitors/{cid}").status_code == 204
    assert client.get(f"/api/competitors/{cid}").status_code == 404


def test_event_create_duplicate_and_validation(client):
    cid = mk_comp(client).json()["id"]
    body = {"competitor_id": cid, "category": "pricing", "title": "Acme cuts price 10%", "event_date": "2025-01-10"}
    assert client.post("/api/events", json=body).status_code == 201
    d = client.post("/api/events", json=body)
    assert d.status_code == 409 and d.json()["error"]["existing_event_id"]
    assert client.post("/api/events", json={**body, "competitor_id": 999, "title": "other"}).status_code == 404
    assert client.post("/api/events", json={**body, "category": "bogus"}).status_code == 422


def test_ssrf_rejections():
    for u in ["http://127.0.0.1/x", "http://localhost/", "file:///etc/passwd", "http://169.254.169.254/latest", "http://10.0.0.5/", "ftp://a.com", "http://user:pw@example.com/"]:
        with pytest.raises(urlsafe.UnsafeURL):
            urlsafe.validate_public_url(u)


def test_analyze_invalid_url_and_missing_input(client):
    assert client.post("/api/events/analyze", json={"url": "http://127.0.0.1:8000/admin"}).status_code == 422
    assert client.post("/api/events/analyze", json={"text": "short"}).status_code == 422


def test_analyze_heuristic_mode_labelled(client):
    cid = mk_comp(client).json()["id"]
    r = client.post("/api/events/analyze", json={"competitor_id": cid, "text": "Acme announces a 20% price cut on its subscription plan, effective 2025-03-01. The new price is $20 per seat."})
    j = r.json()
    assert r.status_code == 200 and j["analysis_mode"] == "heuristic" and j["category"] == "pricing"
    assert str(j["event_date"]) == "2025-03-01" and j["implications"] == []  # nothing fabricated
    assert any("rule-based" in n.lower() or "No LLM" in n for n in j["notes"])


class _Bad:
    name = "bad"
    async def complete_json(self, *a, **k):
        raise LLMError("boom")


def test_analyze_llm_failure_falls_back(client):
    set_llm(_Bad())
    cid = mk_comp(client).json()["id"]
    j = client.post("/api/events/analyze", json={"competitor_id": cid, "text": "Acme launches a new feature for analytics dashboards today with 3 widgets."}).json()
    set_llm(None)
    assert j["analysis_mode"] == "heuristic" and any("failed" in n for n in j["notes"])


@pytest.mark.asyncio
async def test_groq_malformed_then_fallback_model():
    calls = []
    def handler(req):
        m = json.loads(req.content)["model"]
        calls.append(m)
        content = "not json at all" if len(calls) == 1 else json.dumps({"category": "pricing", "title": "Price cut announced"})
        return httpx.Response(200, json={"choices": [{"message": {"content": content}}]})
    p = GroqProvider(Settings(_env_file=None, groq_api_key="k"), transport=httpx.MockTransport(handler))
    out = await p.complete_json("sys", "user", ClassificationLLM)
    assert out.category == "pricing" and len(calls) == 2 and calls[0] != calls[1]


@pytest.mark.asyncio
async def test_groq_provider_http_error():
    p = GroqProvider(Settings(_env_file=None, groq_api_key="k"), transport=httpx.MockTransport(lambda r: httpx.Response(500)))
    with pytest.raises(LLMError):
        await p.complete_json("s", "u", ClassificationLLM)


def test_hindsight_unconfigured_is_skipped_not_success(seeded):
    e = seeded.get("/api/events?category=pricing").json()["items"][0]
    r = seeded.post("/api/recommendations", json={"event_id": e["id"]})
    assert r.status_code == 201
    mem = r.json()["memory"]
    assert mem["status"] == "unconfigured" and any("not configured" in w or "unavailable" in w for w in r.json()["warnings"])
    ops = seeded.get("/api/memory/operations").json()["items"]
    assert ops and all(o["status"] == "skipped" for o in ops)


def test_decision_and_outcome_validation(seeded):
    ev = seeded.get("/api/events").json()["items"][0]["id"]
    d = seeded.post("/api/decisions", json={"event_id": ev, "title": "Test decision", "decision": "Do X", "strategy_type": "targeted_discount", "expected_acquisition_pct": 5, "expected_margin_pct": -1})
    assert d.status_code == 201
    did = d.json()["id"]
    assert d.json()["audit"]["verdict"] == "pending"  # missing outcome is not failure
    assert seeded.post("/api/decisions", json={"event_id": 99999, "title": "abc", "decision": "abc"}).status_code == 404
    assert seeded.post("/api/outcomes", json={"decision_id": did, "outcome_status": "success"}).status_code == 422
    o = seeded.post("/api/outcomes", json={"decision_id": did, "acquisition_change_pct": 6, "margin_change_pct": -0.5, "measurement_days": 45, "outcome_status": "success"})
    assert o.status_code == 201 and o.json()["audit"]["verdict"] == "supported"
    short = seeded.post("/api/outcomes", json={"decision_id": did, "acquisition_change_pct": 6, "margin_change_pct": -3, "measurement_days": 10, "outcome_status": "mixed"}).json()
    assert short["audit"]["verdict"] == "mixed" and not short["audit"]["measurement_sufficient"]


def test_insights_endpoints(seeded):
    sig = seeded.get("/api/strategy-signals").json()["items"]
    assert any(s["competitor"] == "RivalPro" and s["theme"] == "ai" for s in sig)
    assert all(s["status"] == "hypothesis" for s in sig)
    dna = seeded.get("/api/decision-dna").json()
    assert dna["total_decisions"] == 6 and dna["same_strategy_different_results"]
    aud = seeded.get("/api/assumption-audit").json()
    assert aud["missing_evidence"] and "supported" in aud["counts"]
    hw = seeded.get("/api/health-warnings").json()
    assert hw["superseded_events"] and hw["conflicts"] and hw["stale_events"] and hw["short_measurement"]
    cf = seeded.get("/api/counterfactual").json()
    assert "HYPOTHETICAL" in cf["label"] and any(o["recorded_experience"] == 0 for o in cf["options"])
    d = seeded.get("/api/dashboard").json()
    assert d["counts"]["events"] == 25


def test_demo_flow_memory_changes_recommendation(seeded):
    r1 = seeded.post("/api/demo/steps/1").json()
    rec1 = r1["recommendation"]
    assert rec1["history_used"] is False and rec1["influenced_by"] == []
    assert rec1["experiences"] == []  # unrelated categories are NOT evidence
    assert rec1["recommended"]["strategy"] == "other" and "No recorded" in " ".join(rec1["missing_evidence"])
    assert seeded.post("/api/demo/steps/4").status_code == 422  # ordering enforced
    d = seeded.post("/api/demo/steps/2").json()["decision_id"]
    seeded.post("/api/demo/steps/3")
    rec2 = seeded.post("/api/demo/steps/4").json()["recommendation"]
    assert rec2["history_used"] is True and d in rec2["influenced_by"]
    assert rec2["recommended"]["strategy"] in ("targeted_discount", "feature_bundle")
    assert "broad discount" in rec2["recommended"]["action"].lower() and "+8.0%" in rec2["recommended"]["rationale"] and "-5.0%" in rec2["recommended"]["rationale"]
    assert rec2["recommended"]["strategy"] != rec1["recommended"]["strategy"]
    evo = seeded.get("/api/memory-evolution").json()["items"]
    last = [e for e in evo if e["recommendation_id"] == rec2["id"]][0]
    assert last["delta"]["previously_no_history"] and d in last["delta"]["new_experiences"]
    # idempotent steps
    assert seeded.post("/api/demo/steps/2").json()["decision_id"] == d


def test_superseded_event_blocks_recommendation(seeded):
    evs = seeded.get("/api/events?q=15%25 price cut").json()["items"]
    assert seeded.post("/api/recommendations", json={"event_id": evs[0]["id"]}).status_code == 422


FEED = b"""<?xml version="1.0"?><rss version="2.0"><channel><title>Acme Blog</title>
<item><title>Acme cuts Pro price by 15%</title><link>https://acme.example/p1</link><pubDate>Mon, 03 Mar 2025 10:00:00 GMT</pubDate><description>&lt;p&gt;New pricing: $19 per seat.&lt;/p&gt;</description></item>
<item><title>Acme hiring ML engineers</title><link>https://acme.example/p2</link><pubDate>Tue, 04 Mar 2025 10:00:00 GMT</pubDate><description>Open roles for engineers.</description></item></channel></rss>"""


@pytest.mark.asyncio
async def test_rss_preview_parses_and_flags_duplicates(client, db):
    from app.services import ingest
    cid = mk_comp(client).json()["id"]
    tr = httpx.MockTransport(lambda r: httpx.Response(200, content=FEED, headers={"content-type": "application/rss+xml"}))
    # DNS is not available in tests, so patch validation for the mock host only
    orig = urlsafe.validate_public_url
    urlsafe.validate_public_url = lambda u: u
    try:
        items = await ingest.rss_preview(db, cid, "https://acme.example/feed.xml", 10, tr)
    finally:
        urlsafe.validate_public_url = orig
    assert len(items) == 2 and items[0]["category"] == "pricing" and str(items[0]["event_date"]) == "2025-03-03"
    assert items[0]["source_url"] == "https://acme.example/p1" and not items[0]["duplicate"]


def test_rss_endpoint_rejects_private_and_unknown_competitor(client):
    cid = mk_comp(client).json()["id"]
    assert client.post("/api/events/rss-preview", json={"competitor_id": cid, "url": "http://127.0.0.1/feed"}).status_code == 422
    assert client.post("/api/events/rss-preview", json={"competitor_id": 999, "url": "https://x.example/f"}).status_code == 404
