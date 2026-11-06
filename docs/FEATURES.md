# Feature checklist and limitations
Legend: ✅ implemented and exercised by tests or browser run · ⚠️ implemented with a stated limitation · ❌ not done

| # | Feature | Status | Notes |
|---|---|---|---|
| 1 | Competitor management | ✅ | CRUD, search/filter, confirm-delete, profile |
| 2 | Intelligence collection | ✅ | Manual, URL (SSRF-safe), RSS/Atom preview-and-import (imported as unverified, rule-based classification), seeded dataset |
| 3 | AI event classification | ⚠️ | Groq path validated by Pydantic and unit-tested with mocked HTTP; **never run against live Groq here**. Heuristic fallback is labelled. |
| 4 | Competitive timeline | ✅ | |
| 5 | Strategy signal fusion | ✅ | Theme-keyword clustering; hypotheses only |
| 6 | Decision DNA | ✅ | |
| 7 | Decision & outcome tracker | ✅ | Missing outcomes supported |
| 8 | Assumption audit | ✅ | Deterministic; lessons retained when measurement ≥30 days |
| 9 | Response effectiveness | ✅ | Caveats shown; no causal claims |
| 10 | Strategic AI advisor | ⚠️ | Full workflow; LLM path untested live |
| 11 | Memory explorer | ✅ | Real operation log; ad-hoc recall/reflect |
| 12 | Counterfactual comparison | ⚠️ | Based on recorded outcomes only; labelled hypothetical |
| 13 | Contradiction & staleness | ✅ | Rule-based (percent figures, dates, supersession, short windows) |
| 14 | Memory evolution view | ✅ | |
| — | **Live Hindsight round trip** | ❌ **unverified** | Built to SDK signatures; run `scripts/hindsight_smoke.py` |

## Known limitations
- Hindsight and Groq were not exercised live (no credentials in the build environment). Hindsight behaviour is covered with a test double; the reflect/recall response parsing follows the installed SDK models.
- No authentication or multi-tenant support; single company bank.
- SSRF check resolves DNS before connecting; a DNS-rebinding race is theoretically possible. Use a network egress policy in production.
- Signal fusion uses keyword themes, so it can miss or over-group; strength is based on evidence counts.
- Synthetic data is small (25 events, 6 decisions); averages over so few cases are illustrative.
- `datetime` values are naive UTC; SQLite only.
- RSS import uses keyword classification only (no LLM), so categories need review.
