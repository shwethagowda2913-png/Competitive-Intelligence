import hashlib, re
from bs4 import BeautifulSoup
from datetime import date

from sqlalchemy import select
from sqlalchemy.orm import Session

from ..ai.llm import LLMError, get_llm
from ..models import Competitor, Event, EventSource
from ..schemas import AnalyzeIn, AnalyzeOut, ClassificationLLM, EventIn
from .themes import detect_themes
from .urlsafe import FetchError, UnsafeURL, fetch_page

CAT_WORDS = {
    "pricing": ["price", "pricing", "discount", "per seat", "per user", "/mo", "subscription", "plan cost", "free tier", "% off", "cheaper"],
    "hiring": ["hiring", "hires", "job opening", "job posting", "recruit", "engineer role", "careers", "head of", "vp of", "open roles"],
    "product_launch": ["launch", "released", "introduces", "new feature", "rolls out", "announces", "beta", "general availability", "now available"],
    "market_expansion": ["expands", "expansion", "new region", "opens office", "enters", "apac", "emea", "latam", "new market", "localized"],
    "marketing": ["campaign", "messaging", "rebrand", "tagline", "positioning", "webinar", "advert", "sponsor", "homepage now"],
}


def norm(s: str) -> str:
    return re.sub(r"[^a-z0-9]+", " ", s.lower()).strip()


def content_hash(competitor_id: int, title: str, event_date: date | None) -> str:
    return hashlib.sha256(f"{competitor_id}|{norm(title)}|{event_date or ''}".encode()).hexdigest()


class Duplicate(Exception):
    def __init__(self, event_id: int):
        self.event_id = event_id


def create_event(db: Session, data: EventIn, synthetic: bool = False) -> Event:
    if not db.get(Competitor, data.competitor_id):
        raise LookupError("competitor not found")
    h = content_hash(data.competitor_id, data.title, data.event_date)
    ex = db.scalar(select(Event).where(Event.content_hash == h))
    if ex:
        raise Duplicate(ex.id)
    ev = Event(competitor_id=data.competitor_id, category=data.category, title=data.title.strip(), description=data.description,
               event_date=data.event_date, verification_status=data.verification_status, facts=data.facts,
               implications=data.implications, uncertainty=data.uncertainty, analysis_mode=data.analysis_mode,
               content_hash=h, is_synthetic=synthetic,
               themes=detect_themes(f"{data.title} {data.description} {' '.join(data.facts)}"))
    if data.source and (data.source.name or data.source.url):
        ev.sources.append(EventSource(name=data.source.name, url=data.source.url))
    db.add(ev)
    db.commit()
    return ev


def heuristic_classify(text: str, title_hint: str = "") -> ClassificationLLM:
    t = text.lower()
    scores = {c: sum(t.count(w) for w in ws) for c, ws in CAT_WORDS.items()}
    cat = max(scores, key=scores.get) if max(scores.values()) > 0 else "other"
    sentences = [s.strip() for s in re.split(r"(?<=[.!?])\s+", text) if s.strip()]
    title = (title_hint or (sentences[0] if sentences else text))[:200]
    facts = [s[:300] for s in sentences if re.search(r"\d", s)][:5]
    m = re.search(r"\b(20\d{2})-(\d{2})-(\d{2})\b", text)
    d = None
    if m:
        try:
            d = date(int(m[1]), int(m[2]), int(m[3]))
        except ValueError:
            pass
    return ClassificationLLM(category=cat, title=title if len(title) >= 3 else "Untitled competitor event", description=text[:1500],
                             event_date=d, facts=facts, implications=[],
                             uncertainty="Rule-based extraction (no LLM configured or LLM unavailable): category inferred from keywords; "
                                         "no strategic interpretation generated; review before relying on it.")


SYSTEM = ("You extract structured competitive-intelligence events from text about a competitor of a SaaS company. "
          "Use ONLY information present in the text. If a field is not stated, use null or an empty list — never guess or invent "
          "dates, numbers or sources. 'facts' must be statements literally supported by the text. 'implications' are possible strategic "
          "implications and must be phrased as hypotheses. 'uncertainty' states what is unclear. Category must be one of: pricing, "
          "product_launch, marketing, hiring, market_expansion, other. verification_status is 'unverified' unless the text is an official "
          "company announcement.")


async def analyze(db: Session, req: AnalyzeIn, transport=None) -> AnalyzeOut:
    notes: list[str] = []
    text, title_hint, url = (req.text or "").strip(), "", None
    if req.url:
        try:
            url, title_hint, page_text = await fetch_page(req.url, transport)
        except UnsafeURL as e:
            raise ValueError(f"URL rejected: {e}")
        except FetchError as e:
            raise ValueError(f"URL could not be read: {e}")
        text = f"{text}\n{page_text}".strip()
    if len(text) < 20:
        raise ValueError("Provide at least 20 characters of text or a readable URL")
    comp = db.get(Competitor, req.competitor_id) if req.competitor_id else None
    result, mode = None, "heuristic"
    llm = get_llm()
    if llm:
        try:
            result = await llm.complete_json(SYSTEM, f"Competitor (if known): {comp.name if comp else 'unknown'}\n\nTEXT:\n{text[:9000]}", ClassificationLLM)
            mode = "llm"
        except LLMError as e:
            notes.append(f"LLM classification failed ({e}); used rule-based extraction instead.")
    else:
        notes.append("No LLM configured: using rule-based extraction. Add GROQ_API_KEY for AI classification.")
    if result is None:
        result = heuristic_classify(text, title_hint)
    cid = comp.id if comp else None
    if not cid and result.competitor_name:
        m = db.scalar(select(Competitor).where(Competitor.name.ilike(result.competitor_name.strip())))
        cid = m.id if m else None
        if not m:
            notes.append(f"Detected competitor '{result.competitor_name}' is not registered; choose one before saving.")
    return AnalyzeOut(competitor_id=cid, category=result.category, title=result.title, description=result.description or text[:1500],
                      event_date=result.event_date, source_name=req.source_name or (url or ""), source_url=url,
                      facts=result.facts, implications=result.implications, uncertainty=result.uncertainty,
                      verification_status=result.verification_status, analysis_mode=mode, notes=notes)


async def rss_preview(db: Session, competitor_id: int, url: str, limit: int = 10, transport=None) -> list[dict]:
    """Parse an RSS/Atom feed into UNSAVED event previews (rule-based classification; the user reviews and imports)."""
    import feedparser
    from .urlsafe import fetch_bytes
    comp = db.get(Competitor, competitor_id)
    if not comp:
        raise LookupError("competitor not found")
    try:
        final, _, body, _ = await fetch_bytes(url, transport, ("xml", "rss", "atom", "text"))
    except UnsafeURL as e:
        raise ValueError(f"URL rejected: {e}")
    except FetchError as e:
        raise ValueError(f"Feed could not be read: {e}")
    feed = feedparser.parse(body)
    if not feed.entries:
        raise ValueError("No entries found — is this an RSS or Atom feed?")
    out = []
    for e in feed.entries[:limit]:
        raw = (e.get("summary") or e.get("description") or "")
        text = " ".join(BeautifulSoup(raw, "html.parser").get_text(" ", strip=True).split()) if raw else ""
        title = (e.get("title") or "").strip()
        res = heuristic_classify(f"{title}. {text}" if text else title, title)
        d = None
        if e.get("published_parsed"):
            try:
                d = date(*e.published_parsed[:3])
            except (TypeError, ValueError):
                pass
        h = content_hash(competitor_id, res.title, d)
        out.append({"competitor_id": competitor_id, "category": res.category, "title": res.title[:300], "description": text[:1500], "event_date": d,
                    "source_name": feed.feed.get("title", "RSS feed"), "source_url": e.get("link"), "facts": res.facts, "analysis_mode": "heuristic",
                    "verification_status": "unverified", "duplicate": db.scalar(select(Event.id).where(Event.content_hash == h)) is not None})
    return out
