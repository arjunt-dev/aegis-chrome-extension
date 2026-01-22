from pydantic import BaseModel, EmailStr, Field, AnyHttpUrl
from datetime import datetime


# ============================================
# Authentication Schemas
# ============================================

class SignupRequest(BaseModel):
    """Zero-knowledge signup - client sends encrypted master key"""
    email: EmailStr
    password: str
    confirm_password: str
    encrypted_master_key: str  # Client-encrypted master key with password-derived key
    password_salt: str  # Salt for PBKDF2 key derivation (safe to store)

class SignupResponse(BaseModel):
    message: str
    email: EmailStr

class LoginRequest(BaseModel):
    email: EmailStr
    password: str

class LoginResponse(BaseModel):
    """Zero-knowledge login - return encrypted master key for client decryption"""
    access_token: str
    refresh_token: str
    token_type: str = "bearer"
    encrypted_master_key: str  # Return encrypted master key blob
    password_salt: str  # Return salt for key derivation
    master_key_version: int  # Track version for multi-device sync

class OtpVerifyRequest(BaseModel):
    email: EmailStr
    code: str = Field(..., min_length=6, max_length=6)

class OtpVerifyResponse(BaseModel):
    message: str
    recovery_codes: list[str]

class TokenResponse(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"

class RefreshTokenRequest(BaseModel):
    refresh_token: str

class UserOut(BaseModel):
    id: int
    email: EmailStr
    is_active: bool
    created_at: datetime | None = None

    class Config:
        from_attributes = True


# ============================================
# Password Reset Schemas (Zero-Knowledge)
# ============================================

class RecoveryCodeVerifyRequest(BaseModel):
    """Step 1: Verify recovery code"""
    email: EmailStr
    recovery_code: str

class PasswordResetResponse(BaseModel):
    """Step 1: Return encrypted master key (encrypted with recovery code)"""
    message: str
    encrypted_master_key: str

class PasswordResetRequest(BaseModel):
    """Step 2: Complete password reset with re-encrypted master key"""
    email: EmailStr
    new_password: str
    new_password_salt: str
    new_encrypted_master_key: str  # Master key re-encrypted with new password
    new_recovery_codes: list[dict]  # New recovery codes


# ============================================
# ML Prediction Schemas
# ============================================

class PredictionRequest(BaseModel):
    url: AnyHttpUrl

class PredictionResponse(BaseModel):
    url: str
    prediction: int
    confidence: float | None = None


# ============================================
# Zero-Knowledge Blocklist Schemas
# ============================================

class BlocklistCreate(BaseModel):
    """Client sends encrypted URL + hash"""
    encrypted_url: str  # Base64(IV + AES-GCM encrypted URL)
    url_hash: str  # SHA256 hash for deduplication

class BlocklistItem(BaseModel):
    """Server returns encrypted data - client decrypts"""
    id: int
    encrypted_url: str  # Encrypted URL blob
    url_hash: str  # Hash (server can check duplicates without seeing URL)
    added_at: datetime

    class Config:
        from_attributes = True


# ============================================
# Zero-Knowledge History Schemas
# ============================================

class HistoryCreate(BaseModel):
    """Client sends encrypted URL + hash + prediction results"""
    encrypted_url: str  # Base64(IV + AES-GCM encrypted URL)
    url_hash: str  # SHA256 hash
    result: str  # Prediction result (can be plaintext)
    confidence: float | None = None

class HistoryItem(BaseModel):
    """Server returns encrypted URLs - client decrypts"""
    id: int
    encrypted_url: str  # Encrypted URL blob
    url_hash: str  # Hash
    result: str  # Prediction result
    confidence: float | None = None
    checked_at: datetime

    class Config:
        from_attributes = True