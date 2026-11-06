# API (all under `/api`; interactive docs at `/docs`)
Errors: `{"error": {"message": "...", "fields": [...]}}`. Lists: `{items, total, page, page_size}`.

| Method | Path | Purpose |
|---|---|---|
| GET | /health · /integrations | Health; Hindsight/LLM/DB status |
| GET POST | /competitors · PUT DELETE GET /competitors/{id} | CRUD, `q`, `industry`, pagination |
| GET POST | /events (filters: competitor_id, category, verification, q, date_from, date_to) | List / create (409 on duplicate) |
| GET PATCH DELETE | /events/{id} | Detail; verify, mark superseded |
| POST | /events/rss-preview | RSS/Atom feed → unsaved event previews (SSRF-safe) |
| POST | /events/analyze | Text and/or URL → structured, editable extraction |
| GET | /sources | Event sources |
| GET POST | /decisions · GET DELETE /decisions/{id} | Decisions with embedded outcome + audit |
| POST | /outcomes | Record/update outcome (upsert per decision) |
| POST GET | /recommendations · GET /recommendations/{id} | Generate / list |
| GET | /strategy-signals · /decision-dna · /assumption-audit · /effectiveness · /counterfactual · /health-warnings · /dashboard · /memory-evolution | Analytics |
| GET | /memory/operations · /memory/history?event_id= | Logged Hindsight operations; live recall for an event |
| POST | /memory/recall · /memory/reflect · /memory/sync | Direct memory queries; retain unsynced records |
| GET POST | /demo/status · /demo/steps/{1-4} · /demo/reset | Guided demo (simulated data) |
