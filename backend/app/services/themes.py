import re

THEMES = {
    "ai": ["ai ", " ai", "artificial intelligence", "machine learning", "ml engineer", "llm", "copilot", "generative", "gpt", "assistant", "agentic"],
    "enterprise": ["enterprise", "sso", "saml", "scim", "audit log", "fortune", "large organi", "procurement", "sla"],
    "low_price": ["discount", "price cut", "lower-priced", "cheaper", "free plan", "lower price", "reduc", "starter plan", "% off", "promo"],
    "security_compliance": ["soc 2", "soc2", "iso 27001", "gdpr", "hipaa", "compliance", "encryption"],
    "international": ["apac", "emea", "latam", "india", "europe", "singapore", "germany", "japan", "brazil", "localiz", "new region", "expan"],
    "integrations": ["integration", "api", "marketplace", "connector", "slack", "salesforce", "partner"],
    "automation": ["automation", "workflow", "autom", "self-serve", "self-service"],
}


def detect_themes(text: str) -> list[str]:
    t = f" {text.lower()} "
    return sorted(k for k, words in THEMES.items() if any(w in t for w in words))


def percents(text: str) -> list[float]:
    return [float(x) for x in re.findall(r"(\d+(?:\.\d+)?)\s*%", text)]
