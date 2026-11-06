from datetime import datetime, date, timezone
from sqlalchemy import (JSON, Boolean, CheckConstraint, Date, DateTime, Float, ForeignKey, Index, Integer, String,
                        Text, UniqueConstraint)
from sqlalchemy.orm import Mapped, mapped_column, relationship
from .db import Base

CATEGORIES = ["pricing", "product_launch", "marketing", "hiring", "market_expansion", "other"]
STRATEGIES = ["broad_discount", "targeted_discount", "feature_bundle", "no_response", "other"]


def now():
    return datetime.now(timezone.utc).replace(tzinfo=None)


class Competitor(Base):
    __tablename__ = "competitors"
    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(120), unique=True)
    industry: Mapped[str] = mapped_column(String(120), default="")
    website: Mapped[str] = mapped_column(String(300), default="")
    description: Mapped[str] = mapped_column(Text, default="")
    is_synthetic: Mapped[bool] = mapped_column(Boolean, default=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=now)
    events: Mapped[list["Event"]] = relationship(back_populates="competitor", cascade="all, delete-orphan")


class Event(Base):
    __tablename__ = "events"
    __table_args__ = (Index("ix_events_comp_date", "competitor_id", "event_date"), Index("ix_events_cat", "category"),
                      CheckConstraint("verification_status in ('verified','unverified','disputed')"))
    id: Mapped[int] = mapped_column(primary_key=True)
    competitor_id: Mapped[int] = mapped_column(ForeignKey("competitors.id", ondelete="CASCADE"))
    category: Mapped[str] = mapped_column(String(30))
    title: Mapped[str] = mapped_column(String(300))
    description: Mapped[str] = mapped_column(Text, default="")
    event_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    collected_at: Mapped[datetime] = mapped_column(DateTime, default=now)
    verification_status: Mapped[str] = mapped_column(String(20), default="unverified")
    facts: Mapped[list] = mapped_column(JSON, default=list)
    implications: Mapped[list] = mapped_column(JSON, default=list)
    themes: Mapped[list] = mapped_column(JSON, default=list)
    uncertainty: Mapped[str] = mapped_column(Text, default="")
    analysis_mode: Mapped[str] = mapped_column(String(20), default="manual")  # llm | heuristic | manual
    content_hash: Mapped[str] = mapped_column(String(64), unique=True)
    is_synthetic: Mapped[bool] = mapped_column(Boolean, default=False)
    superseded_by_id: Mapped[int | None] = mapped_column(ForeignKey("events.id", ondelete="SET NULL"), nullable=True)
    competitor: Mapped[Competitor] = relationship(back_populates="events")
    sources: Mapped[list["EventSource"]] = relationship(back_populates="event", cascade="all, delete-orphan")
    decisions: Mapped[list["Decision"]] = relationship(back_populates="event")


class EventSource(Base):
    __tablename__ = "event_sources"
    id: Mapped[int] = mapped_column(primary_key=True)
    event_id: Mapped[int] = mapped_column(ForeignKey("events.id", ondelete="CASCADE"), index=True)
    name: Mapped[str] = mapped_column(String(200), default="")
    url: Mapped[str | None] = mapped_column(String(1000), nullable=True)
    fetched_at: Mapped[datetime] = mapped_column(DateTime, default=now)
    event: Mapped[Event] = relationship(back_populates="sources")


class Decision(Base):
    __tablename__ = "decisions"
    id: Mapped[int] = mapped_column(primary_key=True)
    event_id: Mapped[int] = mapped_column(ForeignKey("events.id", ondelete="CASCADE"), index=True)
    title: Mapped[str] = mapped_column(String(300))
    strategy_type: Mapped[str] = mapped_column(String(30), default="other")
    decision: Mapped[str] = mapped_column(Text)
    rationale: Mapped[str] = mapped_column(Text, default="")
    assumption: Mapped[str] = mapped_column(Text, default="")
    expected_result: Mapped[str] = mapped_column(Text, default="")
    expected_acquisition_pct: Mapped[float | None] = mapped_column(Float, nullable=True)
    expected_margin_pct: Mapped[float | None] = mapped_column(Float, nullable=True)
    decided_on: Mapped[date] = mapped_column(Date, default=date.today)
    approved: Mapped[bool] = mapped_column(Boolean, default=True)
    is_synthetic: Mapped[bool] = mapped_column(Boolean, default=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=now)
    event: Mapped[Event] = relationship(back_populates="decisions")
    outcome: Mapped["Outcome | None"] = relationship(back_populates="decision", uselist=False, cascade="all, delete-orphan")


class Outcome(Base):
    __tablename__ = "outcomes"
    __table_args__ = (UniqueConstraint("decision_id"),)
    id: Mapped[int] = mapped_column(primary_key=True)
    decision_id: Mapped[int] = mapped_column(ForeignKey("decisions.id", ondelete="CASCADE"))
    actual_result: Mapped[str] = mapped_column(Text, default="")
    acquisition_change_pct: Mapped[float | None] = mapped_column(Float, nullable=True)
    margin_change_pct: Mapped[float | None] = mapped_column(Float, nullable=True)
    measurement_days: Mapped[int | None] = mapped_column(Integer, nullable=True)
    outcome_status: Mapped[str] = mapped_column(String(20), default="pending")  # success|failure|mixed|pending
    is_synthetic: Mapped[bool] = mapped_column(Boolean, default=False)
    recorded_at: Mapped[datetime] = mapped_column(DateTime, default=now)
    decision: Mapped[Decision] = relationship(back_populates="outcome")


class Recommendation(Base):
    __tablename__ = "recommendations"
    id: Mapped[int] = mapped_column(primary_key=True)
    event_id: Mapped[int] = mapped_column(ForeignKey("events.id", ondelete="CASCADE"), index=True)
    engine: Mapped[str] = mapped_column(String(30))
    payload: Mapped[dict] = mapped_column(JSON)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=now)


class MemoryOperation(Base):
    __tablename__ = "memory_operations"
    id: Mapped[int] = mapped_column(primary_key=True)
    op_type: Mapped[str] = mapped_column(String(20), index=True)  # retain|recall|reflect
    status: Mapped[str] = mapped_column(String(20))  # success|error|skipped
    bank_id: Mapped[str] = mapped_column(String(120), default="")
    related_type: Mapped[str] = mapped_column(String(20), default="")
    related_id: Mapped[int | None] = mapped_column(Integer, nullable=True)
    query: Mapped[str] = mapped_column(Text, default="")
    result: Mapped[dict] = mapped_column(JSON, default=dict)
    error: Mapped[str] = mapped_column(Text, default="")
    duration_ms: Mapped[int] = mapped_column(Integer, default=0)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=now, index=True)


class RetainedItem(Base):
    """Tracks which SQLite records have been successfully retained in Hindsight (idempotency)."""
    __tablename__ = "retained_items"
    __table_args__ = (UniqueConstraint("kind", "ref_id"),)
    id: Mapped[int] = mapped_column(primary_key=True)
    kind: Mapped[str] = mapped_column(String(20))
    ref_id: Mapped[int] = mapped_column(Integer)
    document_id: Mapped[str] = mapped_column(String(80))
    content_hash: Mapped[str] = mapped_column(String(64))
    retained_at: Mapped[datetime] = mapped_column(DateTime, default=now)
