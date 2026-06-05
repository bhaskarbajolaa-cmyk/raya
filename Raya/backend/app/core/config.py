import os
from pydantic_settings import BaseSettings

# Load .env file manually if it exists in the backend root directory
backend_root = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
env_path = os.path.join(backend_root, ".env")
if os.path.exists(env_path):
    with open(env_path, "r", encoding="utf-8") as f:
        for line in f:
            line = line.strip()
            if line and not line.startswith("#"):
                parts = line.split("=", 1)
                if len(parts) == 2:
                    key = parts[0].strip()
                    value = parts[1].strip().strip('"').strip("'")
                    os.environ[key] = value

class Settings(BaseSettings):
    PROJECT_NAME: str = "RAYA AI Assistant"
    SECRET_KEY: str = "supersecretkey_change_in_production_123"
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 30
    
    class Config:
        case_sensitive = True

settings = Settings()

