from datetime import datetime, timezone
from tortoise.transactions import in_transaction
from models import Otp
from tortoise.expressions import Q

async def cleanup_expired_otps():
    try:
        print(f"[OTP Cleanup] Running cleanup at { datetime.now(timezone.utc)}")
        async with in_transaction() as conn:
            deleted_count = await Otp.filter(Q(is_used=True) | Q(expires_at__lt=datetime.now(timezone.utc))).using_db(conn).delete()
            if deleted_count:
                print(f"[OTP Cleanup] Deleted {deleted_count} expired/used OTP(s) at { datetime.now(timezone.utc)}")
    except Exception as e:
        print(f"[OTP Cleanup] Error: {e}")