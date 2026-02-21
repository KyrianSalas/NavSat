from pydantic_settings import BaseSettings

class Settings(BaseSettings):
    # new_var = celeste_api_key: str
    database_url: str = "sqlite:///./satellites.db"  # Placeholder for DB

    class Config:
        env_file = ".env"

settings = Settings()
