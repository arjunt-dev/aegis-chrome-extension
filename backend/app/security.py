from datetime import timedelta
from argon2 import PasswordHasher
from argon2.exceptions import VerifyMismatchError
from fastapi import HTTPException,status
from fastapi.params import Depends
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from models import Otp,User
from utils import now_utc, validate_password_strength
import jwt
from config import JWT_SETTINGS, SECRET_KEY
from tortoise.exceptions import DoesNotExist

ph = PasswordHasher()
security = HTTPBearer()

async def create_user(email: str, password: str, encrypted_master_key: str, password_salt: str):
    """
    Create user with zero-knowledge architecture
    Server never sees the master key or secret
    """
    try:
        
        validate_password_strength(password)
        
        # Hash password for authentication (separate from encryption)
        password_hash = ph.hash(password.strip().encode('utf-8'))
        
        user = await User.create(
            email=email,
            password=password_hash,
            password_salt=password_salt,
            encrypted_master_key=encrypted_master_key,
            master_key_version=1
        )
        return user, password_salt
    except Exception as e:
        print(f"Error creating user: {e}")
        return None, None

async def authenticate(email: str, password: str):
    try:
        user = await User.get(email=email)
        password_bytes = password.strip().encode('utf-8')
        ph.verify(user.password, password_bytes)
        if ph.check_needs_rehash(user.password):
            user.password = ph.hash(password_bytes)
            await user.save()
        return user
    except (DoesNotExist, VerifyMismatchError):
        return None

async def verify_otp_for_user(user, code: str) -> bool:
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
    
def create_access_token(data: dict, expires_delta: timedelta = None):
    try:
        to_encode = data.copy()
        expire = now_utc() + (expires_delta or timedelta(minutes=JWT_SETTINGS['access_token_expire_minutes']))
        to_encode.update({"exp": expire, "type": "access"})
        return jwt.encode(to_encode, SECRET_KEY, algorithm=JWT_SETTINGS['algorithm'])
    except Exception as e:
        return None
    
def create_refresh_token(data: dict, expires_delta: timedelta = None):
    try:
        to_encode = data.copy()
        expire = now_utc() + (expires_delta or timedelta(days=JWT_SETTINGS['refresh_token_expire_days']))
        to_encode.update({"exp": expire, "type": "refresh"})
        return jwt.encode(to_encode, SECRET_KEY, algorithm=JWT_SETTINGS['algorithm']),expire
    except Exception as e:
        return None
    
async def issue_token(user:User):
    access_token=create_access_token({"sub": str(user.id)})
    refresh_token,expire=create_refresh_token({"sub": str(user.id)})
    return access_token,refresh_token

async def verify_token(token: str, expected_type: str = "access"):
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[JWT_SETTINGS['algorithm']])
        if expected_type is not None and payload.get("type") != expected_type:
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token type")
        return payload
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Token expired")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token")

async def refresh_access_token(refresh_token: str):
    try:
        payload = await verify_token(refresh_token, expected_type="refresh")
        user_id = payload.get("sub")
        user= await User.get(id=user_id)
        access_token,refresh_token = await issue_token(user)
        return access_token,refresh_token
    except HTTPException as e:
        raise e

async def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(security)):
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