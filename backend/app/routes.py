from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from predict import predict_url
from schemas import (
    BlocklistCreate, BlocklistItem, HistoryCreate, HistoryItem, 
    LoginRequest, LoginResponse, PredictionRequest, PredictionResponse, 
    RefreshTokenRequest, SignupRequest, SignupResponse, TokenResponse,
    OtpVerifyRequest, OtpVerifyResponse, RecoveryCodeVerifyRequest,
    PasswordResetRequest, PasswordResetResponse
)
from security import authenticate, create_user, get_current_user, issue_token, refresh_access_token, verify_otp_for_user, verify_token
from models import Blocklist, History, User, RecoveryCode
from tortoise.exceptions import IntegrityError, DoesNotExist
from fastapi_limiter.depends import RateLimiter
from utils import now_utc
import signals

router = APIRouter(prefix="/api", tags=["API"])
security = HTTPBearer(auto_error=True)

# ============================================
# Authentication Endpoints
# ============================================

@router.post("/signup", response_model=SignupResponse, status_code=status.HTTP_201_CREATED,
             dependencies=[Depends(RateLimiter(times=5, seconds=300))])
async def signup(data: SignupRequest):
    """
    Zero-knowledge signup:
    - Client generates random master key
    - Client encrypts master key with password-derived key
    - Server stores encrypted master key (cannot decrypt it)
    """
    try:
        if data.password != data.confirm_password:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST, 
                detail="Passwords do not match"
            )
        
        user, password_salt = await create_user(
            email=data.email,
            password=data.password,
            encrypted_master_key=data.encrypted_master_key,
            password_salt=data.password_salt
        )
        
        if not user:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST, 
                detail="User creation failed"
            )
        
        # Store recovery codes (encrypted master key with recovery code wrapper)
        for recovery_data in data.recovery_codes:
            await RecoveryCode.create(
                user=user,
                code_hash=recovery_data['code_hash'],
                encrypted_master_key=recovery_data['encrypted_master_key']
            )
        
        print(f"User signed up: {user.email}")
        return SignupResponse(
            message="User created successfully. Save your recovery codes!",
            email=user.email
        )
    except IntegrityError:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, 
            detail="User with this email already exists"
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, 
            detail=f"Internal server error: {str(e)}"
        )

@router.post("/login", response_model=LoginResponse, status_code=status.HTTP_200_OK,
             dependencies=[Depends(RateLimiter(times=10, seconds=60))])
async def login(data: LoginRequest):
    """
    Zero-knowledge login:
    - Authenticate user with password hash
    - Return encrypted master key + salt
    - Client decrypts master key locally
    """
    try:
        user = await authenticate(data.email, data.password)
        if not user:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED, 
                detail="Invalid credentials"
            )
        if not user.is_active:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN, 
                detail="User account is inactive. Please verify your email."
            )
        
        access_token, refresh_token = await issue_token(user)
        
        return LoginResponse(
            access_token=access_token,
            refresh_token=refresh_token,
            encrypted_master_key=user.encrypted_master_key,
            password_salt=user.password_salt,
            master_key_version=user.master_key_version
        )
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, 
            detail=f"Internal server error: {str(e)}"
        )

@router.post("/verify", response_model=OtpVerifyResponse, status_code=status.HTTP_200_OK,
             dependencies=[Depends(RateLimiter(times=10, seconds=60))])
async def verify(data: OtpVerifyRequest):
    """Verify OTP to activate account"""
    try:
        user = await User.get_or_none(email=data.email)
        if not user:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="User not found"
            )
        
        is_verified = await verify_otp_for_user(user, data.code)
        if not is_verified:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid or expired OTP"
            )
        
        return OtpVerifyResponse(message="Account verified successfully")
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, 
            detail="Internal server error"
        )

@router.post("/refresh", response_model=TokenResponse, status_code=status.HTTP_200_OK,
             dependencies=[Depends(RateLimiter(times=10, seconds=60))])
async def refresh_token(data: RefreshTokenRequest):
    """Refresh access token"""
    try:
        access_token, refresh_token = await refresh_access_token(data.refresh_token)
        if not access_token:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED, 
                detail="Invalid refresh token"
            )
        return TokenResponse(
            access_token=access_token,
            refresh_token=refresh_token
        )
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, 
            detail="Internal server error"
        )

@router.post("/logout", status_code=status.HTTP_200_OK)
async def logout(credentials: HTTPAuthorizationCredentials = Depends(security)):
    """Logout"""
    try:
        token = credentials.credentials
        payload = await verify_token(token, expected_type=None)

        return {"detail": "Successfully logged out"}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Internal server error: {str(e)}"
        )

# ============================================
# Password Reset Endpoints (Zero-Knowledge)
# ============================================

@router.post("/password-reset/verify-recovery", response_model=PasswordResetResponse,
             dependencies=[Depends(RateLimiter(times=5, seconds=300))])
async def verify_recovery_code(data: RecoveryCodeVerifyRequest):
    """
    Step 1: Verify recovery code and return encrypted master key
    Zero-knowledge: Server never sees the recovery code plaintext
    """
    try:
        user = await User.get_or_none(email=data.email)
        if not user:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="User not found"
            )
        
        # Find matching recovery code
        recovery_codes = await RecoveryCode.filter(
            user=user, 
            is_used=False
        ).all()
        
        from argon2 import PasswordHasher
        from argon2.exceptions import VerifyMismatchError
        ph = PasswordHasher()
        
        for rc in recovery_codes:
            try:
                ph.verify(rc.code_hash, data.recovery_code)
                # Mark as used
                rc.is_used = True
                rc.used_at = now_utc()
                await rc.save()
                
                return PasswordResetResponse(
                    message="Recovery code verified",
                    encrypted_master_key=rc.encrypted_master_key
                )
            except VerifyMismatchError:
                continue
        
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid recovery code"
        )
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Recovery verification failed"
        )

@router.post("/password-reset/complete", status_code=status.HTTP_200_OK,
             dependencies=[Depends(RateLimiter(times=5, seconds=300))])
async def complete_password_reset(data: PasswordResetRequest):
    """
    Step 2: Update password and re-encrypt master key
    Zero-knowledge: Master key remains the same, just re-wrapped
    """
    try:
        user = await User.get_or_none(email=data.email)
        if not user:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="User not found"
            )
        
        from argon2 import PasswordHasher
        ph = PasswordHasher()
        
        # Update password and master key encryption
        user.password = ph.hash(data.new_password.strip().encode('utf-8'))
        user.password_salt = data.new_password_salt
        user.encrypted_master_key = data.new_encrypted_master_key
        user.master_key_version += 1
        user.last_password_change = now_utc()
        await user.save()
        
        # Delete old recovery codes
        await RecoveryCode.filter(user=user).delete()
        
        # Create new recovery codes
        for rc_data in data.new_recovery_codes:
            await RecoveryCode.create(
                user=user,
                code_hash=rc_data['code_hash'],
                encrypted_master_key=rc_data['encrypted_master_key']
            )
        
        return {"message": "Password reset successful"}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(e)
        )

# ============================================
# ML Prediction Endpoint (No auth required)
# ============================================

@router.post("/predict", response_model=PredictionResponse, status_code=status.HTTP_200_OK,
             dependencies=[Depends(RateLimiter(times=20, seconds=60))])
async def predict(data: PredictionRequest):
    """
    ML phishing prediction - No encryption needed
    URL is only used temporarily for prediction, not stored
    """
    try:
        prediction_result = predict_url(str(data.url))
        return PredictionResponse(
            url=prediction_result["url"],
            prediction=prediction_result["prediction"],
            confidence=prediction_result["confidence"]
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, 
            detail=f"Prediction failed: {str(e)}"
        )

# ============================================
# Zero-Knowledge Blocklist Endpoints
# ============================================

@router.get("/blocklist", response_model=list[BlocklistItem], status_code=status.HTTP_200_OK)
async def get_blocklist(user: User = Depends(get_current_user)):
    """
    Get encrypted blocklist - Client decrypts locally
    Server returns encrypted URLs and hashes only
    """
    try:
        blocklist = await Blocklist.filter(user=user).order_by('-added_at').all()
        return blocklist
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, 
            detail="Failed to fetch blocklist"
        )

@router.post("/blocklist", response_model=BlocklistItem, status_code=status.HTTP_201_CREATED)
async def add_to_blocklist(data: BlocklistCreate, user: User = Depends(get_current_user)):
    """
    Add encrypted URL to blocklist
    Client sends: encrypted_url + url_hash
    Server checks hash for duplicates without seeing URL
    """
    try:
        # Check for duplicate using hash
        exists = await Blocklist.filter(
            user=user, 
            url_hash=data.url_hash
        ).exists()
        
        if exists:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="This URL already exists in your blocklist"
            )
        
        new_item = await Blocklist.create(
            user=user,
            encrypted_url=data.encrypted_url,
            url_hash=data.url_hash
        )
        return new_item
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, 
            detail="Failed to add to blocklist"
        )

@router.delete("/blocklist/{item_id}", status_code=status.HTTP_204_NO_CONTENT)
async def remove_from_blocklist(item_id: str, user: User = Depends(get_current_user)):
    """Delete blocklist item(s)"""
    try:
        if item_id == "all":
            await Blocklist.filter(user=user).delete()
            return
        
        deleted_count = await Blocklist.filter(id=int(item_id), user=user).delete()
        if deleted_count == 0:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND, 
                detail="Blocklist item not found"
            )
        return
    except ValueError:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid item ID"
        )
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, 
            detail="Failed to delete item"
        )

# ============================================
# Zero-Knowledge History Endpoints
# ============================================

@router.get("/history", response_model=list[HistoryItem], status_code=status.HTTP_200_OK)
async def get_history(user: User = Depends(get_current_user)):
    """
    Get encrypted history - Client decrypts locally
    Server returns encrypted URLs, prediction results visible
    """
    try:
        history = await History.filter(user=user).order_by('-checked_at').all()
        return history
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, 
            detail="Failed to fetch history"
        )

@router.post("/history", response_model=HistoryItem, status_code=status.HTTP_201_CREATED)
async def add_to_history(data: HistoryCreate, user: User = Depends(get_current_user)):
    """
    Add encrypted URL to history with prediction result
    Client sends: encrypted_url + url_hash + result + confidence
    """
    try:
        new_entry = await History.create(
            user=user,
            encrypted_url=data.encrypted_url,
            url_hash=data.url_hash,
            result=data.result,
            confidence=data.confidence
        )
        return new_entry
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, 
            detail="Failed to add to history"
        )

@router.delete("/history/{item_id}", status_code=status.HTTP_204_NO_CONTENT)
async def remove_from_history(item_id: str, user: User = Depends(get_current_user)):
    """Delete history item(s)"""
    try:
        if item_id == "all":
            await History.filter(user=user).delete()
            return
        
        deleted_count = await History.filter(id=int(item_id), user=user).delete()
        if deleted_count == 0:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND, 
                detail="History item not found"
            )
        return
    except ValueError:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid item ID"
        )
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, 
            detail="Failed to delete item"
        )