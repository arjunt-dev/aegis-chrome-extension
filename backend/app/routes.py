from fastapi import APIRouter, Depends, HTTPException, Request, Response, status
from fastapi.security import HTTPBearer
from predict import predict_url,logger
from schemas import (
    LoginRequest, LoginResponse, PredictionRequest, PredictionResponse, 
    SignupRequest, SignupResponse, OtpVerifyRequest, OtpVerifyResponse, VaultResponse, VaultUpdateRequest,
    EncryptedPayload
)
from security import authenticate, create_user, get_current_user, issue_token, refresh_access_token, verify_otp_for_user
from models import User, Vault
from tortoise.exceptions import IntegrityError
from fastapi_limiter.depends import RateLimiter
from utils import safe_mail
import signals
import json

router = APIRouter(prefix="/api", tags=["API"])
security = HTTPBearer(auto_error=True)

@router.post("/signup", response_model=SignupResponse,
             status_code=status.HTTP_201_CREATED,
             dependencies=[Depends(RateLimiter(times=5, seconds=300))])

async def signup(data: SignupRequest):

    if data.password != data.confirm_password:
        logger.warning(f"Signup attempt with non-matching passwords for email: {safe_mail(data.email)}")
        raise HTTPException(400, "Passwords do not match")

    try:
        user = await create_user(
            email=data.email,
            password=data.password,
            salt=data.salt,
            enc_master_user=json.dumps(data.enc_master_user_key.model_dump())
        )
        logger.info(f"New user created: {safe_mail(data.email)}")
        return SignupResponse(message="User created successfully")
    except HTTPException as http_exc:
        # Re-raise password validation and other HTTP exceptions
        logger.warning(f"Signup attempt failed for email: {safe_mail(data.email)} - {str(http_exc.detail)}")
        raise http_exc
    except IntegrityError as e:
        # Database constraint violation (e.g., duplicate email)
        logger.warning(f"Signup attempt with existing email: {safe_mail(data.email)}")
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="User already exists")
    except Exception as e:
        # Unexpected errors - log full details for debugging
        logger.error(f"Unexpected error during signup for {safe_mail(data.email)}: {str(e)}")
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Signup failed")


@router.post("/login", response_model=LoginResponse)
async def login(data: LoginRequest):
    try:
        user = await authenticate(data.email, data.password)
        access_token, refresh_token = await issue_token(user)

        return LoginResponse(
            access_token=access_token,
            refresh_token=refresh_token,
            salt=user.password_salt,
            enc_master_user=EncryptedPayload(**json.loads(user.encrypted_master_key) if isinstance(user.encrypted_master_key, str) else user.encrypted_master_key)
        )
    except Exception as e:
        logger.warning(f"Failed login attempt for {safe_mail(data.email)}{str(e)}")
        raise HTTPException(401,"Login failed")

@router.post("/refresh")
async def refresh_token(request: Request):
    try:
        body = await request.json()
        refresh_token = body.get("refresh_token")
        if not refresh_token:
            raise HTTPException(401, "Refresh token required")

        access_token, new_refresh = await refresh_access_token(refresh_token)

        return {
            "access_token": access_token,
            "refresh_token": new_refresh,
            "token_type": "bearer"
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.warning(f"Failed token refresh attempt: {str(e)}")
        raise HTTPException(500)

@router.post("/verify-otp", response_model=OtpVerifyResponse)
async def verify(data: OtpVerifyRequest):
    try:
        user = await User.get_or_none(email=data.email)
        if not user:
            raise HTTPException(404, "User not found")

        verified = await verify_otp_for_user(user, data.code)
        if not verified:
            raise HTTPException(400, "Invalid OTP")
        
        return OtpVerifyResponse(message="Account verified")
    except HTTPException:
           raise
    except Exception as e:
        logger.warning(f"OTP verification failed for email: {safe_mail(data.email)} {str(e)}")
        raise HTTPException(500)


@router.post("/logout")
async def logout():
    return {"message": "Logged out"}


@router.get("/vault", response_model=VaultResponse)
async def get_vault(user: User = Depends(get_current_user)):
    try:
        vault = await Vault.get_or_none(user=user)

        if not vault:
            return VaultResponse(blob=None)

        return VaultResponse(blob=EncryptedPayload(**json.loads(vault.encrypted_blob) if isinstance(vault.encrypted_blob, str) else vault.encrypted_blob))
    except Exception as e:
        logger.error(f"Error retrieving vault for user {user.email}: {str(e)}")
        raise HTTPException(500)


@router.post("/vault", status_code=status.HTTP_200_OK)
async def update_vault(
    data: VaultUpdateRequest,
    user: User = Depends(get_current_user)
):
    try:
        vault = await Vault.get_or_none(user=user)

        if vault:
            vault.encrypted_blob = json.dumps(data.blob.model_dump())
            await vault.save()
        else:
            await Vault.create(
                user=user,
                encrypted_blob=json.dumps(data.blob.model_dump())
            )

        return {"message": "Vault updated"}
    except Exception as e:
        logger.error(f"Error updating vault for user {user.email}: {str(e)}")
        raise HTTPException(500)



@router.post("/predict", response_model=PredictionResponse,
             dependencies=[Depends(RateLimiter(times=20, seconds=60))])
async def predict(data: PredictionRequest):
    try:
        result = predict_url(str(data.url))
        return PredictionResponse(
            prediction=result["prediction"],
            confidence=result["confidence"]
        )
    except Exception as e:
        logger.error(f"Prediction error : {str(e)}")
        raise HTTPException(500, f"Prediction failed")