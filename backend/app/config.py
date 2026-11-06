from functools import lru_cache
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")
    database_url: str = "sqlite:///./strategic_memory_lab.db"
    cors_origins: str = "http://localhost:5173,http://127.0.0.1:5173"
    hindsight_base_url: str = "https://api.hindsight.vectorize.io"
    hindsight_api_key: str = ""
    hindsight_bank_id: str = "strategic-memory-lab-clouddesk"
    hindsight_timeout: float = 60.0
    groq_api_key: str = ""
    llm_model: str = "openai/gpt-oss-120b"
    llm_fallback_model: str = "qwen/qwen3-32b"
    llm_timeout: float = 45.0
    fetch_timeout: float = 8.0
    fetch_max_bytes: int = 1_000_000
    company_name: str = "CloudDesk"

    @property
    def cors_list(self) -> list[str]:
        return [o.strip() for o in self.cors_origins.split(",") if o.strip()]

    @property
    def hindsight_enabled(self) -> bool:
        local = "localhost" in self.hindsight_base_url or "127.0.0.1" in self.hindsight_base_url
        return bool(self.hindsight_api_key) or local

    @property
    def llm_enabled(self) -> bool:
        return bool(self.groq_api_key)


@lru_cache
def get_settings() -> Settings:
    return Settings()
