# Architecture

Modular monolith. SQLite is the **structured source of truth**; Hindsight is the **semantic experience memory**. Neither substitutes for the other.

```
React + Vite + TS + Tailwind + TanStack Query + Recharts  ──/api──▶  FastAPI
                                                                      │
   api/ (routers)  →  services/ (ingest, advisor, analytics, memory_sync, demo, seed)
                                  │                         │                 │
                          SQLAlchemy/SQLite        memory/hindsight_adapter    ai/llm (Groq, replaceable)
                          (Alembic migrations)     (SDK, retry, op log)        (Pydantic-validated JSON)
```

## Backend (`backend/app`)
| Module | Responsibility |
|---|---|
| `models.py` | competitors, events, event_sources, decisions, outcomes, recommendations, memory_operations, retained_items. FKs, CHECK/UNIQUE constraints, indexes, content-hash dedupe. |
| `memory/hindsight_adapter.py` | The only code that touches the Hindsight SDK. 3 attempts with backoff on transient errors; every call logged to `memory_operations` (`success` / `error` / `skipped`). |
| `services/memory_sync.py` | Idempotent retain via `document_id` (`event-N`, `decision-N`, `outcome-N`, `lesson-N`) + content hash (`retained_items`). Only **verified** events and **approved** decisions are retained; lessons only when the measurement period is ≥ 30 days. |
| `services/advisor.py` | Validate event → gather same-category decisions with outcomes (SQLite) → Hindsight recall + reflect → LLM (or rule engine) → persisted recommendation with evidence, alternatives, uncertainty, missing evidence, warnings. |
| `services/analytics.py` | Assumption audit, Decision DNA, strategy-signal fusion, effectiveness, counterfactuals, staleness/contradiction detection, dashboard. All computed from stored records. |
| `services/ingest.py`, `urlsafe.py` | Extraction (LLM → Pydantic validation → heuristic fallback), SSRF-safe fetch (scheme/port/credential checks, DNS→public-IP check on every hop, redirect re-validation, 1 MB cap, timeout). |
| `ai/llm.py` | `LLMProvider` protocol; Groq via HTTPX; primary + fallback model; malformed JSON is rejected, never trusted. |

## Design decisions
- **No fabricated confidence.** Evidence strength is a qualitative label from the *count of relevant measured experiences*, explicitly "not a probability".
- **Relevance gate.** Only decisions triggered by events of the same category count as evidence; unrelated history is excluded and tested.
- **Missing ≠ failure.** Outcomes without data are `pending`/`unmeasured` and listed as missing evidence.
- **Two engines, always labelled.** With `GROQ_API_KEY`: LLM reasoning over the same structured evidence. Without: a deterministic rule engine. The UI shows which ran. If the LLM fails, the rule engine runs and a note says so.
- **Hindsight failure ≠ app failure.** Errors are logged, shown, and the recommendation proceeds from SQLite with an explicit warning. Failed retains are never marked retained.
- **Assumption audit** is deterministic: expected vs measured acquisition and margin → supported / mixed / failed; <30-day windows are flagged provisional.

## Frontend (`frontend/src`)
`pages/` (13 screens + Memory evolution), `components/` (ui primitives, layout, event detail, recommendation view), `lib/` (typed API client, chart tokens). Dark/light theme through CSS variables; keyboard-focus styles; reduced-motion respected; toasts, skeletons, empty and error states, confirm dialogs.
