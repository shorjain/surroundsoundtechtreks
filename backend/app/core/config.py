from pydantic_settings import BaseSettings, SettingsConfigDict

class Settings(BaseSettings):
    app_name: str = "SurroundSound API"
    cors_origins: list[str] = ["http://localhost:5173"]
    mongodb_uri: str | None = None
    mongodb_db: str = "surroundsound"
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

settings = Settings()
