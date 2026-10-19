from typing import Optional
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    # App
    APP_NAME: str = "WhatsApp Fashion AI"
    APP_ENV: str = "development"
    DEBUG: bool = True
    PORT: int = 8000
    SECRET_KEY: str = "super_secret_jwt_key_please_change_in_production"

    # Storefront Website URL
    STOREFRONT_URL: str = "https://ai-whatsapp-power-git-main-hamzachaudhary786s-projects.vercel.app"

    # MongoDB Database
    DATABASE_URL: str = "mongodb://localhost:27017/whatsapp_fashion_db"
    MONGODB_DB_NAME: str = "whatsapp_fashion_db"

    # Redis Cache (Optional for session states)
    REDIS_URL: str = "redis://localhost:6379/0"

    # Meta WhatsApp Cloud API
    WHATSAPP_API_VERSION: str = "v19.0"
    WHATSAPP_PHONE_NUMBER_ID: Optional[str] = None
    WHATSAPP_ACCESS_TOKEN: Optional[str] = None
    WHATSAPP_APP_SECRET: Optional[str] = None
    WHATSAPP_BUSINESS_ACCOUNT_ID: Optional[str] = None
    WHATSAPP_VERIFY_TOKEN: str = "my_secure_webhook_token"

    # AI Model Keys
    AI_PROVIDER: str = "gemini"
    GEMINI_API_KEY: Optional[str] = None
    OPENAI_API_KEY: Optional[str] = None

    # SMTP Email Configuration
    SMTP_HOST: Optional[str] = None
    SMTP_PORT: int = 587
    SMTP_USER: Optional[str] = None
    SMTP_PASS: Optional[str] = None
    SMTP_FROM: str = "Fashion AI Atelier <orders@fashionai.com>"

    def get_product_url(self, product_id: Optional[str] = None) -> str:
        base = (self.STOREFRONT_URL or "https://ai-whatsapp-power-git-main-hamzachaudhary786s-projects.vercel.app").rstrip("/")
        if base.endswith("/id"):
            base = base[:-3].rstrip("/")
        if product_id:
            return f"{base}/{str(product_id).strip()}"
        return base

    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")


settings = Settings()
