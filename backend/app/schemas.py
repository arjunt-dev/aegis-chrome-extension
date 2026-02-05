from pydantic import BaseModel, EmailStr, Field, AnyHttpUrl

class EncryptedPayload(BaseModel):
    iv: str
    ciphertext: str
    v:int


class SignupRequest(BaseModel):
    email: EmailStr
    password: str
    confirm_password: str
    salt: str
    enc_master_user_key: EncryptedPayload


class SignupResponse(BaseModel):
    message: str


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class LoginResponse(BaseModel):
    access_token: str
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
    prediction: int
    confidence: float | None = None

