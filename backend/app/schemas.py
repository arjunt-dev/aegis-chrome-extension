from pydantic import BaseModel, EmailStr, Field,AnyHttpUrl
from datetime import datetime
 
class SignupRequest(BaseModel):
    email: EmailStr
    password: str
    confirm_password: str
    secret: str

class SignupResponse(BaseModel):
    message: str
    email: EmailStr

class OtpVerifyRequest(BaseModel):
    email: EmailStr
    code: str = Field(..., min_length=6, max_length=6)

class OtpVerifyResponse(BaseModel):
    message: str

class LoginRequest(BaseModel):
    email: EmailStr
    password: str

class TokenResponse(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"


class UserOut(BaseModel):
    id: int
    email: EmailStr
    is_active: bool
    is_verified: bool
    created_at: datetime | None = None

class PredictionRequest(BaseModel):
    url: AnyHttpUrl
    
class PredictionResponse(BaseModel):
    url: str
    prediction: int
    confidence: float | None = None

class RefreshTokenRequest(BaseModel):
    refresh_token: str

class BlocklistItem(BaseModel):
    url: str
    added_at: datetime

    class Config:
        from_attributes = True  

class HistoryItem(BaseModel):
    url: str
    result: str
    checked_at: datetime

    class Config:
        from_attributes = True

class HistoryCreate(BaseModel):
    url: str
    result: str

class BlocklistCreate(BaseModel):   
    url: str