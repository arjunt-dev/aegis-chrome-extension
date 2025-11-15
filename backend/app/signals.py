from tortoise import signals
from services import send_otp_email
from utils import create_otp_for_user
from models import User

@signals.post_save(User)
async def user_post_save(sender, instance, created, using_db, update_fields):
    if created:
        otp = await create_otp_for_user(instance)
        print(f"OTP for {instance.email}: {otp}")
        try:
            await send_otp_email(instance.email, otp)
        except Exception as e:
            print(f"[Mail Error] Failed to send OTP to {instance.email}: {e}")