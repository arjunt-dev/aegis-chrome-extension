from datetime import timedelta
from typing import Annotated

from fastapi import HTTPException, status
from fastapi.params import Depends
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from tortoise.exceptions import DoesNotExist

from app.config import JWT_SETTINGS, SECRET_KEY
from app.models import Otp, User
from app.utils import now_utc

import jwt
import secrets
security = HTTPBearer()


async def create_user(
    email: str,
    auth_hash: str,
    salt: str,      
    enc_master_user: str
) -> User:
    user = await User.create(
        email=email,
        password=auth_hash,
        password_salt=salt,
        encrypted_master_key=enc_master_user,
        is_active=False
    )
    return user


async def authenticate(email: str, auth_hash: str) -> User:
    """
    Verify credentials. Uses secrets.compare_digest for constant-time
    comparison to prevent timing-based user enumeration.
    """
    try:
        user = await User.get(email=email)
    except DoesNotExist:
        # Use a dummy compare to keep response time consistent
        secrets.compare_digest("a", "b")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password",
        )

    if not secrets.compare_digest(user.password, auth_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password",
        )

    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Account not verified. Please check your email for the OTP.",
        )

    return user


async def verify_otp_for_user(user: User, code: str) -> bool:
    try:
        otp = await Otp.filter(user=user, code=code, is_used=False).first()
        if otp and otp.expires_at > now_utc():
            otp.is_used = True
            await otp.save()
            user.is_active = True
            await user.save()
            return True
        return False
    except Exception:
        return False


def create_access_token(data: dict, expires_delta: timedelta | None = None) -> str | None:
    try:
        if SECRET_KEY:
            to_encode = data.copy()
            expire = now_utc() + (expires_delta or timedelta(minutes=JWT_SETTINGS['access_token_expire_minutes']))
            to_encode.update({"exp": expire, "type": "access"})
            token = jwt.encode(to_encode, SECRET_KEY, algorithm=JWT_SETTINGS['algorithm'])
            if isinstance(token, bytes):
                return token.decode("utf-8")
            return token
        return None
    except Exception:
        return None


def create_refresh_token(data: dict, expires_delta: timedelta | None = None) -> str | None:
    try:
        if SECRET_KEY:
            to_encode = data.copy()
            expire = now_utc() + (expires_delta or timedelta(days=JWT_SETTINGS['refresh_token_expire_days']))
            to_encode.update({"exp": expire, "type": "refresh"})
            token = jwt.encode(to_encode, SECRET_KEY, algorithm=JWT_SETTINGS['algorithm'])
            if isinstance(token, bytes):
                return token.decode("utf-8")
            return token
        return None
    except Exception:
        return None


async def issue_token(user: User) -> tuple[str, str]:
    access_token = create_access_token({"sub": str(user.id)})
    refresh_token = create_refresh_token({"sub": str(user.id)})
    return str(access_token), str(refresh_token)


async def verify_token(token: str, expected_type: str = "access") -> dict:
    try:
        if not SECRET_KEY:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Server configuration error",
            )
        payload = jwt.decode(token, SECRET_KEY, algorithms=[JWT_SETTINGS['algorithm']])
        if expected_type is not None and payload.get("type") != expected_type:
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token type")
        return payload
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Token expired")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token")


async def refresh_access_token(refresh_token: str) -> tuple[str, str]:
    try:
        payload = await verify_token(refresh_token, expected_type="refresh")
        user_id = payload.get("sub")
        if not user_id:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid token payload",
            )
        user = await User.get(id=user_id)
        return await issue_token(user)
    except HTTPException:
        raise
    except DoesNotExist:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User not found",
        )


async def get_current_user(
    credentials: Annotated[HTTPAuthorizationCredentials, Depends(security)]
) -> User:
    token = credentials.credentials
    payload = await verify_token(token, expected_type="access")
    user_id = payload.get("sub")
    try:
        user = await User.get(id=user_id)
    except DoesNotExist:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found",
        )

    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="User is inactive",
        )
    return user