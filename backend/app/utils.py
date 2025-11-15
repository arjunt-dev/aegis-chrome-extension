
import re
import secrets

from fastapi import HTTPException,status
from models import Otp
from datetime import datetime, timedelta, timezone
from zoneinfo import ZoneInfo
from config import TIMEZONE

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
        exists = await Otp.filter(code=otp_code).exists()
        if not exists:
            return otp_code
        
async def create_otp_for_user(user):
    expires_at = now_utc() + timedelta(minutes=10)
    otp_code = await generate_otp()
    await Otp.create(user=user, code=otp_code, expires_at=expires_at, is_used=False)
    return otp_code

def validate_password_strength(password: str):
    if len(password) < 8:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST,
                            detail="Password must be at least 8 characters long.")
    if re.search(r"\s", password):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST,
                            detail="Password must not contain spaces.")
    if not re.search(r"[A-Z]", password):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST,
                            detail="Password must contain at least one uppercase letter.")
    if not re.search(r"[a-z]", password):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST,
                            detail="Password must contain at least one lowercase letter.")
    if not re.search(r"[0-9]", password):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST,
                            detail="Password must contain at least one digit.")
    if not re.search(r"[!@#$%^&*(),.?\":{}|<>]", password):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST,
                            detail="Password must contain at least one special character.")
    
    weak_passwords = {
        "admin@123","pass@123","password@123"
    }
    if password.lower() in weak_passwords:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST,
                            detail="Password is too common or easily guessable.")