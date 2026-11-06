import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from starlette.exceptions import HTTPException as StarletteHTTPException

from . import models  # noqa: F401
from .api import competitors, decisions, events, insights, system
from .config import get_settings
from .db import Base, SessionLocal, engine
from .logging_conf import setup_logging
from .services.seed import ensure_seeded

log = logging.getLogger("app")


@asynccontextmanager
async def lifespan(app: FastAPI):
    setup_logging()
    Base.metadata.create_all(engine)  # Alembic migrations are the primary path; this keeps first run frictionless
    with SessionLocal() as db:
        ensure_seeded(db)
    yield


app = FastAPI(title="Strategic Memory Lab API", version="1.0.0", lifespan=lifespan,
              description="Competitive intelligence agent with Hindsight memory. Demo data is SIMULATED.")
app.add_middleware(CORSMiddleware, allow_origins=get_settings().cors_list, allow_methods=["*"], allow_headers=["*"])
for r in (system.router, competitors.router, events.router, decisions.router, insights.router):
    app.include_router(r)


@app.exception_handler(StarletteHTTPException)
async def http_exc(_: Request, exc: StarletteHTTPException):
    d = exc.detail
    return JSONResponse({"error": d if isinstance(d, dict) else {"message": str(d)}}, status_code=exc.status_code)


@app.exception_handler(RequestValidationError)
async def val_exc(_: Request, exc: RequestValidationError):
    errs = [{"field": ".".join(str(x) for x in e["loc"][1:]), "message": e["msg"]} for e in exc.errors()]
    return JSONResponse({"error": {"message": "Validation failed", "fields": errs}}, status_code=422)


@app.exception_handler(Exception)
async def any_exc(_: Request, exc: Exception):
    log.exception("unhandled error")
    return JSONResponse({"error": {"message": "Internal server error"}}, status_code=500)
