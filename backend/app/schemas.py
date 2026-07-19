from pydantic import BaseModel, EmailStr, Field, AnyHttpUrl

class EncryptedPayload(BaseModel):
    iv: str
    ciphertext: str
    v: int


class PreLoginRequest(BaseModel):
    email: EmailStr


class PreLoginResponse(BaseModel):
    salt: str


class SignupRequest(BaseModel):
    email: EmailStr
    auth_hash: str = Field(..., min_length=32)
    salt: str = Field(..., description="Hex-encoded PBKDF2 salt generated client-side")
    enc_master_user_key: EncryptedPayload


class SignupResponse(BaseModel):
    message: str


class LoginRequest(BaseModel):
    email: EmailStr
    # ZK: client sends the Argon2id/PBKDF2 hash, never the raw password.
    auth_hash: str = Field(..., min_length=32)


class LoginResponse(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"
    salt: str
    enc_master_user: EncryptedPayload


class OtpVerifyRequest(BaseModel):
    email: EmailStr
    code: str = Field(..., min_length=6, max_length=6)


class OtpVerifyResponse(BaseModel):
    message: str


class VaultResponse(BaseModel):
    blob: EncryptedPayload | None


class VaultUpdateRequest(BaseModel):
    blob: EncryptedPayload


class PredictionRequest(BaseModel):
    url: AnyHttpUrl


class PredictionResponse(BaseModel):
    prediction: str
    confidence: float | None = None
