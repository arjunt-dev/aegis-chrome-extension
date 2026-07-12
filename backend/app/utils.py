
import secrets

from app.models import Otp
from datetime import datetime, timedelta, timezone
from zoneinfo import ZoneInfo
from app.config import TIMEZONE

APP_TIMEZONE = ZoneInfo(TIMEZONE)

def now_utc() -> datetime:
    return datetime.now(timezone.utc)

def now_local() -> datetime:
    return datetime.now(APP_TIMEZONE)

def utc_to_local(dt: datetime) -> datetime:
    return dt.astimezone(APP_TIMEZONE)

async def generate_otp(length: int = 6) -> str:
    while True:
        otp_code = ''.join(secrets.choice('0123456789') for _ in range(length))
        # Only re-generate if an active (unused AND non-expired) OTP already exists with this code
        exists = await Otp.filter(
            code=otp_code,
            is_used=False,
            expires_at__gt=now_utc()
        ).exists()
        if not exists:
            return otp_code
        
async def create_otp_for_user(user):
    expires_at = now_utc() + timedelta(minutes=10)
    otp_code = await generate_otp()
    await Otp.create(user=user, code=otp_code, expires_at=expires_at, is_used=False)
    return otp_code


def safe_mail(email: str) -> str:
    """Mask an email address for safe logging (e.g. jon***@example.com)."""
    local, domain = email.split("@", 1)
    return local[:3] + "***@" + domain

