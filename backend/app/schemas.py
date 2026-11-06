from datetime import date, datetime
from typing import Literal
from pydantic import BaseModel, ConfigDict, Field, field_validator

Category = Literal["pricing", "product_launch", "marketing", "hiring", "market_expansion", "other"]
Strategy = Literal["broad_discount", "targeted_discount", "feature_bundle", "no_response", "other"]
Verification = Literal["verified", "unverified", "disputed"]
OutcomeStatus = Literal["success", "failure", "mixed", "pending"]


class ORM(BaseModel):
    model_config = ConfigDict(from_attributes=True)


class Page(BaseModel):
    items: list
    total: int
    page: int
    page_size: int


# ---- competitors
class CompetitorIn(BaseModel):
    name: str = Field(min_length=1, max_length=120)
    industry: str = Field(default="", max_length=120)
    website: str = Field(default="", max_length=300)
    description: str = Field(default="", max_length=4000)

    @field_validator("name")
    @classmethod
    def strip(cls, v):
        v = v.strip()
        if not v:
            raise ValueError("name required")
        return v


class CompetitorOut(ORM):
    id: int
    name: str
    industry: str
    website: str
    description: str
    is_synthetic: bool
    created_at: datetime
    event_count: int = 0


# ---- events
class SourceIn(BaseModel):
    name: str = Field(default="", max_length=200)
    url: str | None = Field(default=None, max_length=1000)


class SourceOut(ORM):
    id: int
    name: str
    url: str | None
    fetched_at: datetime


class EventIn(BaseModel):
    competitor_id: int
    category: Category
    title: str = Field(min_length=3, max_length=300)
    description: str = Field(default="", max_length=8000)
    event_date: date | None = None
    verification_status: Verification = "unverified"
    source: SourceIn | None = None
    facts: list[str] = []
    implications: list[str] = []
    uncertainty: str = ""
    analysis_mode: Literal["manual", "llm", "heuristic"] = "manual"


class EventOut(ORM):
    id: int
    competitor_id: int
    competitor_name: str = ""
    category: str
    title: str
    description: str
    event_date: date | None
    collected_at: datetime
    verification_status: str
    facts: list
    implications: list
    themes: list
    uncertainty: str
    analysis_mode: str
    is_synthetic: bool
    superseded_by_id: int | None
    sources: list[SourceOut] = []
    retained: bool = False


class EventPatch(BaseModel):
    verification_status: Verification | None = None
    superseded_by_id: int | None = None
    category: Category | None = None


class AnalyzeIn(BaseModel):
    competitor_id: int | None = None
    text: str | None = Field(default=None, max_length=20000)
    url: str | None = Field(default=None, max_length=1000)
    source_name: str = ""


class ClassificationLLM(BaseModel):
    """Schema the LLM must satisfy. Missing information must be null/empty, never invented."""
    competitor_name: str | None = None
    category: Category
    title: str = Field(min_length=3, max_length=300)
    description: str = ""
    event_date: date | None = None
    facts: list[str] = []
    implications: list[str] = []
    uncertainty: str = ""
    verification_status: Verification = "unverified"


class AnalyzeOut(BaseModel):
    competitor_id: int | None
    category: str
    title: str
    description: str
    event_date: date | None
    source_name: str
    source_url: str | None
    facts: list[str]
    implications: list[str]
    uncertainty: str
    verification_status: str
    analysis_mode: str
    notes: list[str] = []


# ---- decisions / outcomes
class DecisionIn(BaseModel):
    event_id: int
    title: str = Field(min_length=3, max_length=300)
    strategy_type: Strategy = "other"
    decision: str = Field(min_length=3)
    rationale: str = ""
    assumption: str = ""
    expected_result: str = ""
    expected_acquisition_pct: float | None = None
    expected_margin_pct: float | None = None
    decided_on: date | None = None
    approved: bool = True


class OutcomeIn(BaseModel):
    decision_id: int
    actual_result: str = ""
    acquisition_change_pct: float | None = None
    margin_change_pct: float | None = None
    measurement_days: int | None = Field(default=None, ge=0, le=3650)
    outcome_status: OutcomeStatus = "pending"


class OutcomeOut(ORM):
    id: int
    decision_id: int
    actual_result: str
    acquisition_change_pct: float | None
    margin_change_pct: float | None
    measurement_days: int | None
    outcome_status: str
    is_synthetic: bool
    recorded_at: datetime


class DecisionOut(ORM):
    id: int
    event_id: int
    event_title: str = ""
    competitor_name: str = ""
    event_category: str = ""
    title: str
    strategy_type: str
    decision: str
    rationale: str
    assumption: str
    expected_result: str
    expected_acquisition_pct: float | None
    expected_margin_pct: float | None
    decided_on: date
    approved: bool
    is_synthetic: bool
    outcome: OutcomeOut | None = None
    audit: dict | None = None


# ---- advisor LLM output
class AltOption(BaseModel):
    strategy: Strategy
    summary: str
    trade_offs: str = ""


class AdvisorLLM(BaseModel):
    ai_interpretation: str
    recommended_strategy: Strategy
    recommended_action: str
    rationale: str
    alternatives: list[AltOption] = []
    uncertainty: list[str] = []
    missing_evidence: list[str] = []
    how_history_changed_it: str = ""


class RecommendIn(BaseModel):
    event_id: int
    use_hindsight: bool = True
