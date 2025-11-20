from fastapi import APIRouter, Depends, HTTPException,status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from predict import predict_url
from schemas import BlocklistCreate, BlocklistItem, HistoryCreate, HistoryItem, LoginRequest, PredictionRequest, PredictionResponse, RefreshTokenRequest, SignupRequest, SignupResponse, TokenResponse,OtpVerifyRequest,OtpVerifyResponse
from security import authenticate, create_user, get_current_user, issue_token, refresh_access_token, revoke_token, verify_otp_for_user, verify_token
from models import Blocklist, History, User
from tortoise.exceptions import IntegrityError
from fastapi_limiter.depends import RateLimiter
import signals

router = APIRouter(prefix="/api",
                   tags=["API"],
    dependencies=[Depends(RateLimiter(times=10, seconds=60))]
)
security = HTTPBearer(auto_error=True)

@router.post("/signup", response_model=SignupResponse,status_code=status.HTTP_201_CREATED)
async def signup(data: SignupRequest):
    try:
        if data.password != data.confirm_password:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Passwords do not match")
        user = await create_user(data.email, data.password, data.secret)
        if not user:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="User creation failed")
        print(f"User signed up: {user, user.email}")
        return SignupResponse(message="User created successfully", email=user.email)
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=f"Internal server error{e}")
@router.post("/login", response_model=TokenResponse,status_code=status.HTTP_200_OK)
async def login(data: LoginRequest):
    try:
        user = await authenticate(data.email, data.password)
        if not user:
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid credentials")
        if user.is_active is False:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="User account is inactive")
        access_token, refresh_token = await issue_token(user)
        return TokenResponse(
            access_token=access_token,
            refresh_token=refresh_token
        )
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=f"Internal server error{e}")
    
@router.post("/verify",response_model=OtpVerifyResponse,status_code=status.HTTP_200_OK)
async def verify(data:OtpVerifyRequest):
    try:
        user=await User.get_or_none(email=data.email)
        if not user:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND,detail="User not found")
        is_verified=await verify_otp_for_user(user,data.code)
        if not is_verified:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST,detail="Invalid or expired OTP")
        return OtpVerifyResponse(message="OTP verified successfully")
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Internal server error")

@router.post("/refresh", response_model=TokenResponse,status_code=status.HTTP_200_OK)
async def refresh_token(data: RefreshTokenRequest):
    try:
        access_token,refresh_token = await refresh_access_token(data.refresh_token)
        if not access_token:
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid refresh token")
        return TokenResponse(
            access_token=access_token,
            refresh_token=refresh_token
        )
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Internal server error")

@router.post("/predict", response_model=PredictionResponse,status_code=status.HTTP_200_OK)
async def predict(data: PredictionRequest):
    try:
        prediction_result = predict_url(str(data.url))
        return PredictionResponse(
            url=prediction_result["url"],
            prediction=prediction_result["prediction"],
            confidence=prediction_result["confidence"]
            )
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=f"Internal server error{e}")

@router.get("/blocklist", response_model=list[BlocklistItem],status_code=status.HTTP_200_OK)
async def get_blocklist(user: User = Depends(get_current_user)):
    try:
        blocklist = await Blocklist.filter(user=user).all()
        return blocklist  
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Internal server error")

@router.post("/blocklist", response_model=BlocklistItem, status_code=status.HTTP_201_CREATED)
async def add_to_blocklist(
    data: BlocklistCreate,
    user: User = Depends(get_current_user)):
    try:
        new_item = await Blocklist.create(user=user, url=data.url)
        return new_item
    except IntegrityError:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="This URL already exists in your blocklist.")
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Internal server error")

@router.delete("/blocklist/{item_id}", status_code=status.HTTP_204_NO_CONTENT)
async def remove_from_blocklist(item_id,user: User = Depends(get_current_user)):
    try:
        if item_id=="all":
            await Blocklist.filter(user=user).delete()
            return  
        deleted_count = await Blocklist.filter(id=item_id, user=user).delete()
        if deleted_count == 0:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Blocklist item not found.")
        return
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Internal server error")

@router.get("/history", response_model=list[HistoryItem],status_code=status.HTTP_200_OK)
async def get_history(user: User = Depends(get_current_user)):
    try:
        history = await History.filter(user=user).all()
        return history
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Internal server error")

@router.post("/history", response_model=HistoryItem, status_code=status.HTTP_201_CREATED)
async def add_to_history(
    data: HistoryCreate,
    user: User = Depends(get_current_user)
):
    try:
        new_entry = await History.create(user=user, url=data.url, result=data.result)
        return new_entry
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Internal server error")
    
@router.delete("/history/{item_id}", status_code=status.HTTP_204_NO_CONTENT)
async def remove_from_history(item_id,user: User = Depends(get_current_user)):
    try:
        if item_id=="all":
            await History.filter(user=user).delete()
            return 
        deleted_count = await History.filter(id=item_id, user=user).delete()
        if deleted_count == 0:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="History item not found.")
        return
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Internal server error")
    
@router.post("/logout", status_code=status.HTTP_200_OK)
async def logout(credentials: HTTPAuthorizationCredentials = Depends(security)):
    """
    Logout endpoint — revokes the current access token (and refresh if desired).
    """
    try:
        token = credentials.credentials
        payload = await verify_token(token, expected_type=None)
        jti = payload.get("jti")

        revoked = await revoke_token(jti)
        if not revoked:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Token already revoked or invalid"
            )

        return {"detail": "Successfully logged out"}

    except HTTPException as e:
        raise e
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Internal server error: {e}"
        )