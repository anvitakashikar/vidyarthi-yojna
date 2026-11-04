from functools import lru_cache
from typing import List

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    APP_NAME: str = "Shidori"
    ENVIRONMENT: str = "development"
    API_PREFIX: str = "/api/v1"

    # MongoDB
    MONGODB_URI: str = "mongodb://localhost:27017"
    MONGODB_DB_NAME: str = "vidyarthi_yojna"

    # Stored as a comma-separated string so it can be set from .env easily
    CORS_ORIGINS: str = "http://localhost:5173"

    # Auth
    JWT_SECRET: str = "change-me-to-a-long-random-string"
    JWT_ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 24

    # Students verify their mobile number with a one-time code before registering.
    # "twilio" sends it by SMS with Twilio Verify; "console" (development only)
    # prints the code in the server log instead of sending an SMS.
    OTP_PROVIDER: str = "console"
    TWILIO_ACCOUNT_SID: str = ""
    TWILIO_AUTH_TOKEN: str = ""
    TWILIO_VERIFY_SERVICE_SID: str = ""

    # Freeform SMS (e.g. "your account has been created"), sent with Twilio's
    # regular Messaging API — separate from Twilio Verify above, which only sends
    # OTP codes. Needs a sender: either a Messaging Service SID or a From number.
    # With OTP_PROVIDER=console, or neither sender set, the message is logged instead.
    TWILIO_MESSAGING_SERVICE_SID: str = ""
    TWILIO_FROM_NUMBER: str = ""

    # Seed admin (created on startup only if no admin exists and a password is set)
    ADMIN_NAME: str = "Administrator"
    ADMIN_EMAIL: str = "admin@vidyarthiyojna.in"
    ADMIN_PASSWORD: str = ""

    # Sensitive data (Aadhaar, bank account numbers, uploaded documents) is
    # encrypted with this Fernet key. Losing it makes that data unreadable.
    DATA_ENCRYPTION_KEY: str = ""

    # Uploaded documents are stored (encrypted) under this folder
    UPLOAD_DIR: str = "uploads"
    MAX_UPLOAD_MB: int = 5

    # Aadhaar reading: the QR code is decoded locally first. If that fails and a key
    # is set, the card image is sent to Claude to read DOB / address / taluka.
    ANTHROPIC_API_KEY: str = ""
    AADHAAR_AI_FALLBACK: bool = True
    AI_MODEL: str = "claude-opus-5-5"

    # Online donations through Razorpay (Dashboard → Account & Settings → API keys).
    # The webhook secret is the one entered when adding the webhook in the dashboard.
    RAZORPAY_KEY_ID: str = ""
    RAZORPAY_KEY_SECRET: str = ""
    RAZORPAY_WEBHOOK_SECRET: str = ""

    # Outgoing email (donation receipts). Port 587 uses STARTTLS, 465 uses SSL.
    SMTP_HOST: str = ""
    SMTP_PORT: int = 587
    SMTP_USERNAME: str = ""
    SMTP_PASSWORD: str = ""
    SMTP_FROM: str = ""  # e.g. "Shidori <receipts@example.org>"
    SMTP_REPLY_TO: str = ""
    # Comma-separated addresses that get a hidden copy of every receipt email
    DONATION_RECEIPT_BCC: str = ""

    # Where donors send donations (shown on the Donate page; empty = hidden)
    DONATION_UPI_ID: str = ""
    DONATION_ACCOUNT_NAME: str = ""
    DONATION_ACCOUNT_NUMBER: str = ""
    DONATION_IFSC: str = ""
    DONATION_BANK_NAME: str = ""

    @property
    def cors_origins_list(self) -> List[str]:
        """Browsers send the origin without a trailing slash or path, so normalise
        values pasted from the address bar ("https://site.vercel.app/ ")."""
        origins = []
        for origin in self.CORS_ORIGINS.split(","):
            origin = origin.strip().strip("\"'").strip().rstrip("/")
            if origin:
                origins.append(origin)
        return origins


@lru_cache
def get_settings() -> Settings:
    return Settings()


settings = get_settings()
