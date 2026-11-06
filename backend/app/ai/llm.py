"""Replaceable LLM provider. Groq (OpenAI-compatible) is the default. Output is always validated with Pydantic."""
import json, logging, re
from typing import Protocol, TypeVar

import httpx
from pydantic import BaseModel, ValidationError

from ..config import Settings, get_settings

log = logging.getLogger("llm")
T = TypeVar("T", bound=BaseModel)


class LLMError(Exception):
    pass


class LLMProvider(Protocol):
    name: str
    async def complete_json(self, system: str, user: str, model: type[T]) -> T: ...


def _extract_json(text: str) -> dict:
    text = re.sub(r"<think>.*?</think>", "", text, flags=re.S).strip()
    text = re.sub(r"^```(?:json)?|```$", "", text.strip(), flags=re.M).strip()
    try:
        return json.loads(text)
    except json.JSONDecodeError:
        m = re.search(r"\{.*\}", text, flags=re.S)
        if not m:
            raise LLMError("Model returned no JSON object")
        return json.loads(m.group(0))


class GroqProvider:
    name = "groq"

    def __init__(self, settings: Settings | None = None, transport: httpx.AsyncBaseTransport | None = None):
        self.s = settings or get_settings()
        self.transport = transport

    async def _chat(self, model_name: str, system: str, user: str) -> str:
        body = {"model": model_name, "temperature": 0.2, "response_format": {"type": "json_object"},
                "messages": [{"role": "system", "content": system}, {"role": "user", "content": user}]}
        async with httpx.AsyncClient(timeout=self.s.llm_timeout, transport=self.transport) as c:
            r = await c.post("https://api.groq.com/openai/v1/chat/completions", json=body,
                             headers={"Authorization": f"Bearer {self.s.groq_api_key}"})
        if r.status_code >= 400:
            raise LLMError(f"Provider returned HTTP {r.status_code}")
        try:
            return r.json()["choices"][0]["message"]["content"] or ""
        except Exception as e:  # noqa
            raise LLMError("Unexpected provider response shape") from e

    async def complete_json(self, system: str, user: str, model: type[T]) -> T:
        schema_hint = json.dumps(model.model_json_schema())[:3500]
        sys_full = f"{system}\nReturn ONLY one JSON object matching this JSON schema. No prose.\n{schema_hint}"
        last: Exception | None = None
        for m in (self.s.llm_model, self.s.llm_fallback_model):
            try:
                raw = await self._chat(m, sys_full, user)
                return model.model_validate(_extract_json(raw))
            except (ValidationError, json.JSONDecodeError, LLMError, httpx.HTTPError) as e:
                log.warning("LLM %s failed: %s", m, type(e).__name__)
                last = e
        raise LLMError(f"All models failed: {type(last).__name__}")


_provider: LLMProvider | None = None


def get_llm() -> LLMProvider | None:
    global _provider
    if _provider is not None:
        return _provider
    s = get_settings()
    return GroqProvider(s) if s.llm_enabled else None


def set_llm(p: LLMProvider | None):
    global _provider
    _provider = p
