from dataclasses import dataclass
from functools import lru_cache
import os

from dotenv import load_dotenv

load_dotenv()


class ConfigError(RuntimeError):
    pass


@dataclass(frozen=True, slots=True)
class Settings:
    google_maps_api_key: str
    request_timeout_seconds: int = 12
    max_email_pages: int = 8
    google_sheets_spreadsheet_id: str = "1lPKb5kvQRD-Gdac05S_vE2uSYzlv1hC7KSUdfLJHrs4"
    google_sheets_credentials_file: str | None = None
    google_sheets_range: str | None = None


@lru_cache(maxsize=1)
def get_settings() -> Settings:
    api_key = os.getenv("GOOGLE_MAPS_API_KEY", "").strip()
    if not api_key:
        raise ConfigError(
            "Missing GOOGLE_MAPS_API_KEY. Add it to your .env file before running searches."
        )

    timeout = int(os.getenv("LEAD_CAPTURE_TIMEOUT", "12"))
    max_email_pages = int(os.getenv("LEAD_CAPTURE_MAX_EMAIL_PAGES", "8"))
    spreadsheet_id = os.getenv(
        "GOOGLE_SHEETS_SPREADSHEET_ID",
        "1lPKb5kvQRD-Gdac05S_vE2uSYzlv1hC7KSUdfLJHrs4",
    ).strip()
    credentials_file = os.getenv("GOOGLE_SHEETS_CREDENTIALS_FILE", "").strip() or None
    sheets_range = os.getenv("GOOGLE_SHEETS_RANGE", "").strip() or None

    return Settings(
        google_maps_api_key=api_key,
        request_timeout_seconds=max(5, timeout),
        max_email_pages=max(1, max_email_pages),
        google_sheets_spreadsheet_id=spreadsheet_id,
        google_sheets_credentials_file=credentials_file,
        google_sheets_range=sheets_range,
    )
