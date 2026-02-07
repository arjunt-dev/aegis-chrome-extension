from tortoise import signals
from services import send_otp_email
from utils import create_otp_for_user,safe_mail
from models import User
from logging_config import logger
@signals.post_save(User)
async def user_post_save(sender, instance, created, using_db, update_fields):
    if created:
        otp = await create_otp_for_user(instance)
        logger.info(f"OTP for {safe_mail(instance.email)}: {otp}")
        try:
            await send_otp_email(instance.email, otp)
        except Exception as e:
            logger.error(f"[Mail Error] Failed to send OTP to {safe_mail(instance.email)}: {e}")