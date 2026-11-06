# Strategic Memory Lab

An outcome-driven **Competitive Intelligence Agent** whose memory is **Hindsight**. It remembers what competitors did, what CloudDesk (the fictional demo company) decided in response, the assumption behind each decision, and what was actually measured — then uses that experience to change future recommendations.

```
Competitor signal → historical context → interpretation → company decision → assumption
        → measured outcome → Hindsight memory → improved recommendation
```

> **Honest status:** a tested hackathon MVP, not a production deployment. All demo data is **SIMULATED** and labelled as such in the UI and in retained memories.

## Quick start
Requirements: Python 3.11+, Node 18+.
```bash
cp .env.example backend/.env        # then fill in keys (optional, see below)
cd backend && pip install -r requirements.txt
python -m alembic upgrade head      # optional: the app also creates tables on first start
python -m uvicorn app.main:app --port 8000
# new terminal
cd frontend && npm install && npm run dev      # http://localhost:5173
```
Or run `./start.sh`. API docs: http://localhost:8000/docs

## Environment variables (`backend/.env`)
| Variable | Purpose |
|---|---|
| `HINDSIGHT_API_KEY` | Hindsight Cloud key (promo `MEMHACK99` per the problem statement). Without it, memory operations are logged as **skipped** — never faked. |
| `HINDSIGHT_BASE_URL` | Default `https://api.hindsight.vectorize.io`; point at a self-hosted instance if you prefer. |
| `HINDSIGHT_BANK_ID` | Memory bank (created automatically). |
| `GROQ_API_KEY` | Enables LLM extraction + reasoning (`openai/gpt-oss-120b`, fallback `qwen/qwen3-32b`). Without it the app runs in clearly labelled **rule-based mode**. |

## Verify Hindsight with your credentials (do this first)
```bash
cd backend && python scripts/hindsight_smoke.py
```
Runs a real retain → recall → reflect round trip and prints the raw output. The app was built against the installed `hindsight-client` SDK signatures (`aretain`, `arecall`, `areflect`), but **it has not been run against a live Hindsight instance** in the build environment (no credentials were available). Expect to spend a few minutes confirming this on your side; failures show up with exact errors in **Memory explorer**.

## The 60-second demo
Open **Strategic AI advisor** → *Guided demo*:
1. **A competitor cuts its price** — RivalOne −20%. No pricing history, so the advisor gives a cautious, evidence-gathering recommendation and says history is absent.
2. **Record the decision** — broad 15% discount; assumption: acquisition ≥ +12%, margin ≥ −2 pts.
3. **Record the outcome** — acquisition +8%, margin −5 pts over 60 days → assumption audited as *failed*; the lesson is retained.
4. **A similar event** — NovaSuite launches a cheaper plan. The recommendation now cites Decision #7, its assumption and measured result, and steers toward a targeted offer or feature bundle instead of another broad discount. **Memory evolution** shows exactly what changed.

Steps are idempotent. **Settings → Reset to demo data** restores the starting state.

## Tests
```bash
cd backend && python -m pytest -q      # 19 tests
cd frontend && npm run build           # typecheck + production build
```
Hindsight tests use an in-memory **test double** (`tests/conftest.py`) to verify adapter behaviour, logging, idempotency and failure handling. It is used only in tests; the app never ships a fake memory.

## Documentation
`ARCHITECTURE.md` · `docs/API.md` · `docs/FEATURES.md` (checklist + limitations) · `docs/SUBMISSION_CHECKLIST.md` (articles, posts, video — **none completed yet**) · `docs/screenshots/`

## Hackathon notes
- Hindsight is the central engine: retain (verified events, approved decisions, measured outcomes, validated lessons), recall + reflect on every recommendation. See `backend/app/memory/hindsight_adapter.py`.
- The problem statement requires the team to download and use **Band AI Desktop** (https://www.band.ai). It is a team tooling requirement; it is **not** integrated into this product, and nothing here claims otherwise.
