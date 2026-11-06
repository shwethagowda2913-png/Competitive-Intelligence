"""Synthetic CloudDesk demo dataset. EVERYTHING here is SIMULATED and flagged is_synthetic=True."""
from datetime import date, timedelta

from sqlalchemy import delete
from sqlalchemy.orm import Session

from ..models import (Competitor, Decision, Event, MemoryOperation, Outcome, Recommendation, RetainedItem)
from ..schemas import EventIn, SourceIn
from . import ingest

COMPETITORS = [
    ("RivalOne", "SaaS — customer support software", "https://rivalone.example", "Price-led challenger targeting small and mid-size support teams. (Simulated)"),
    ("RivalPro", "SaaS — customer support software", "https://rivalpro.example", "Product-led competitor investing heavily in AI. (Simulated)"),
    ("NovaSuite", "SaaS — customer support software", "https://novasuite.example", "Up-market suite moving toward enterprise and international markets. (Simulated)"),
]
# (competitor, category, days_ago, title, description, facts, verification, source)
EV = [
    ("RivalOne", "pricing", 420, "RivalOne raises Pro plan to $29 per seat", "RivalOne raised its Pro subscription from $25 to $29 per seat per month.", ["Pro plan: $25 -> $29 per seat per month"], "verified", "Simulated RivalOne pricing page"),
    ("RivalOne", "pricing", 332, "RivalOne cuts Pro plan price by 20%", "RivalOne announced a 20% reduction in its Pro subscription price to win small teams.", ["Reduction announced: 20%"], "verified", "Simulated Industry Weekly"),
    ("RivalOne", "pricing", 322, "Analyst note reports RivalOne price drop of 12%", "A different analyst source reports RivalOne's Pro plan reduction was closer to 12%.", ["Reported reduction: 12%"], "disputed", "Simulated Analyst Brief"),
    ("RivalOne", "marketing", 250, "RivalOne launches 'Switch and save' campaign", "Marketing campaign targeting customers of larger suites with a switch and save promo discount.", [], "verified", "Simulated RivalOne blog"),
    ("RivalOne", "product_launch", 205, "RivalOne ships mobile app redesign", "New mobile agent app with offline mode and push notifications now available.", [], "verified", "Simulated product changelog"),
    ("RivalOne", "hiring", 160, "RivalOne hiring surge in customer success", "Dozens of open roles in customer success and support onboarding.", ["Open roles in customer success rising"], "unverified", "Simulated careers page"),
    ("RivalOne", "marketing", 120, "RivalOne homepage now promises 'the lowest total cost'", "Messaging shift emphasising lower price and a free plan for startups.", [], "verified", "Simulated homepage capture"),
    ("RivalOne", "product_launch", 75, "RivalOne adds Slack and Salesforce integration marketplace", "A new integration marketplace with Slack and Salesforce connectors.", [], "verified", "Simulated RivalOne blog"),
    ("RivalOne", "market_expansion", 40, "RivalOne opens a London office", "RivalOne expands to Europe with a London office and localized billing in EMEA.", [], "unverified", "Simulated press mention"),
    ("RivalPro", "pricing", 410, "RivalPro announces 15% price cut on Team plan", "RivalPro announced a 15% reduction on its Team plan.", ["Reduction: 15%"], "verified", "Simulated RivalPro blog"),
    ("RivalPro", "pricing", 380, "RivalPro reverses Team plan cut", "RivalPro quietly restored Team plan pricing after the earlier 15% reduction.", [], "verified", "Simulated pricing page"),
    ("RivalPro", "product_launch", 290, "RivalPro releases workflow rules engine", "New automation of ticket routing with a visual workflow builder.", [], "verified", "Simulated release notes"),
    ("RivalPro", "hiring", 200, "RivalPro hires machine learning engineers", "Multiple open roles for ML engineers and an AI product manager.", ["8 ML engineer roles open"], "verified", "Simulated careers page"),
    ("RivalPro", "product_launch", 150, "RivalPro launches AI reply summarizer", "RivalPro introduces an AI assistant that summarizes tickets and drafts replies using a large language model.", [], "verified", "Simulated launch post"),
    ("RivalPro", "marketing", 110, "RivalPro repositions as 'AI-first support platform'", "Homepage messaging and webinars now lead with AI-first positioning and generative assistant demos.", [], "verified", "Simulated homepage capture"),
    ("RivalPro", "product_launch", 60, "RivalPro opens beta of autonomous AI agent", "Beta of an agentic AI assistant that resolves tier-1 tickets automatically.", [], "verified", "Simulated beta announcement"),
    ("RivalPro", "hiring", 45, "RivalPro posts senior AI roles and head of AI", "A head of AI and several LLM engineers listed on careers; AI hiring accelerating.", [], "verified", "Simulated careers page"),
    ("NovaSuite", "product_launch", 300, "NovaSuite announces no-code automation builder", "NovaSuite released a no-code workflow automation builder for support teams.", [], "verified", "Simulated NovaSuite newsroom"),
    ("NovaSuite", "marketing", 230, "NovaSuite earns SOC 2 Type II and ISO 27001", "NovaSuite promotes SOC 2 and ISO 27001 compliance in a new trust campaign for large organizations.", ["SOC 2 Type II and ISO 27001 achieved"], "verified", "Simulated trust center"),
    ("NovaSuite", "product_launch", 185, "NovaSuite adds enterprise SSO and SCIM", "Enterprise features: SAML SSO, SCIM provisioning and audit log with a 99.99% SLA.", [], "verified", "Simulated release notes"),
    ("NovaSuite", "hiring", 140, "NovaSuite hires enterprise account executives", "Open roles for enterprise AEs and solutions engineers focused on large organizations.", ["Enterprise AE roles open"], "verified", "Simulated careers page"),
    ("NovaSuite", "market_expansion", 95, "NovaSuite enters APAC with Singapore hub", "NovaSuite expands to the APAC region, opening a Singapore office and localized support.", [], "verified", "Simulated press release"),
    ("NovaSuite", "marketing", 70, "NovaSuite campaign 'Built for enterprise scale'", "New messaging positions NovaSuite for enterprise procurement and compliance buyers.", [], "verified", "Simulated NovaSuite blog"),
    ("NovaSuite", "pricing", 55, "NovaSuite introduces annual enterprise bundles", "Annual bundle pricing for enterprise plans with included premium features.", [], "verified", "Simulated pricing page"),
    ("NovaSuite", "product_launch", 28, "NovaSuite integrates AI-assisted ticket tagging", "Adds machine learning based automation for auto-tagging and routing.", [], "unverified", "Simulated release notes"),
]

# decisions: (event title, title, strategy, decision, rationale, assumption, expected_result, exp_acq, exp_margin, days_ago, outcome | None)
DEC = [
    ("RivalPro launches AI reply summarizer", "Bundle AI assist into Business plan", "feature_bundle", "Bundle an AI reply-assist add-on into the Business plan at the existing price.",
     "Match the AI capability without discounting.", "Bundled AI features will lift Business-plan sign-ups without hurting margin.", "Acquisition up at least 6% with flat margin.", 6.0, 0.0, 140,
     ("Business-plan sign-ups rose; margin roughly flat.", 7.0, -0.5, 90, "success")),
    ("NovaSuite announces no-code automation builder", "Monitor NovaSuite automation launch", "no_response", "Take no immediate action; monitor win/loss for automation-related deals.",
     "Insufficient evidence of customer demand.", "Customers will not switch for automation alone.", "No change in acquisition.", 0.0, 0.0, 285,
     ("A few deals were lost citing automation; margin unaffected.", -3.0, 0.0, 60, "mixed")),
    ("RivalOne launches 'Switch and save' campaign", "Launch comparison page and migration kit", "other", "Publish a head-to-head comparison page and a free migration kit.",
     "Counter the campaign on value, not price.", "Migration kit will reduce switching losses and win back evaluators.", "Acquisition up 4%.", 4.0, 0.0, 240,
     ("Comparison page converted well.", 5.0, 0.0, 45, "success")),
    ("RivalOne ships mobile app redesign", "Bundle mobile premium features", "feature_bundle", "Bundle premium mobile features into the Pro plan.",
     "Counter RivalOne's mobile push by bundling.", "Bundling mobile features will lift acquisition without price changes.", "Acquisition up 5%, flat margin.", 5.0, 0.0, 195,
     ("Little uptake; mobile bundle added support cost.", 1.0, -1.0, 75, "failure")),
    ("NovaSuite enters APAC with Singapore hub", "Launch APAC partner program", "other", "Recruit two regional resellers to protect APAC pipeline.",
     "Local partners are faster than opening an office.", "Partners will protect APAC pipeline at low cost.", "APAC acquisition up 3%.", 3.0, None, 85, None),
    ("RivalPro hires machine learning engineers", "Accelerate own AI roadmap hiring", "other", "Open six AI engineering roles to close the AI feature gap.",
     "RivalPro's hiring suggests a larger AI push.", "Hiring now shortens time-to-market for our AI features.", "AI roadmap delivered one quarter earlier.", None, None, 190,
     ("Hiring completed on schedule; no commercial metric is available yet.", None, None, 20, "success")),
]


def clear_all(db: Session):
    for m in (Recommendation, MemoryOperation, RetainedItem, Outcome, Decision, Event, Competitor):
        db.execute(delete(m))
    db.commit()


def load_history(db: Session) -> dict:
    today = date.today()
    comps = {}
    for n, ind, w, d in COMPETITORS:
        c = Competitor(name=n, industry=ind, website=w, description=d, is_synthetic=True)
        db.add(c)
        db.flush()
        comps[n] = c
    db.commit()
    by_title = {}
    for comp, cat, ago, title, desc, facts, ver, src in EV:
        e = ingest.create_event(db, EventIn(competitor_id=comps[comp].id, category=cat, title=title, description=desc + " [SIMULATED]", event_date=today - timedelta(days=ago),
                                            verification_status=ver, source=SourceIn(name=src), facts=facts, uncertainty="Simulated data", analysis_mode="manual"), synthetic=True)
        by_title[title] = e
    # superseded: RivalPro's 15% cut was reversed
    by_title["RivalPro announces 15% price cut on Team plan"].superseded_by_id = by_title["RivalPro reverses Team plan cut"].id
    db.commit()
    for et, t, st, dec, rat, ass, exp, ea, em, ago, out in DEC:
        d = Decision(event_id=by_title[et].id, title=t + " [SIMULATED]", strategy_type=st, decision=dec, rationale=rat, assumption=ass, expected_result=exp,
                     expected_acquisition_pct=ea, expected_margin_pct=em, decided_on=today - timedelta(days=ago), is_synthetic=True)
        db.add(d)
        db.flush()
        if out:
            ar, ac, mg, days, status = out
            db.add(Outcome(decision_id=d.id, actual_result=ar + " [SIMULATED]", acquisition_change_pct=ac, margin_change_pct=mg, measurement_days=days, outcome_status=status, is_synthetic=True))
    db.commit()
    return {"competitors": len(COMPETITORS), "events": len(EV), "decisions": len(DEC)}


def ensure_seeded(db: Session):
    if db.query(Competitor).count() == 0:
        load_history(db)
