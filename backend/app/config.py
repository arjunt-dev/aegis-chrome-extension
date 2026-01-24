from apscheduler.schedulers.asyncio import AsyncIOScheduler
from contextlib import asynccontextmanager
from fastapi import FastAPI
import joblib
from tortoise import Tortoise
from dotenv import load_dotenv
import os
from tasks import cleanup_expired_otps
from fastapi_mail import ConnectionConfig
from fastapi_limiter import FastAPILimiter
from redis.asyncio import Redis
from logging_config import setup_logger,logger

load_dotenv()

scheduler = AsyncIOScheduler()
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DEBUG = os.getenv("DEBUG", "True") == "True"
SECRET_KEY = os.getenv("SECRET_KEY") 
DB_URL = "sqlite://db.sqlite3"
EXTENSION_ID="phaapmkjnafbdnnbimibbffdpephgmmh"

TORTOISE_ORM = {
    "connections": {"default": DB_URL},
    "apps": {
        "models": {
            "models": ["models", "aerich.models"],
            "default_connection": "default",
        },
    },
}

async def init_db():
    try:
        await Tortoise.init(config=TORTOISE_ORM)
        await Tortoise.generate_schemas()
    except Exception as e:
        logger.error(f"Error initializing database: {e}")

@asynccontextmanager
async def lifespan(app: FastAPI):
    """
    Manages application startup and shutdown events.
    """
    setup_logger()
    logger.info("Starting up... Initializing database.")
    await init_db()
    logger.info("Database initialized.")
    logger.info("Setting up Rate Limiter with Redis.")
    redis = await Redis.from_url(
        os.getenv("REDIS_URL", "redis://localhost:6379"), encoding="utf8", decode_responses=True
    )
    logger.info("Initializing Rate Limiter with Redis.")
    await FastAPILimiter.init(redis)
    scheduler.add_job(cleanup_expired_otps,
    "interval",
    minutes=5,
    id="otp_cleanup_job",
    replace_existing=True,
    max_instances=1)
    scheduler.start()
    yield 
    scheduler.shutdown()
    logger.info("Shutting down... Closing database connections.")
    await Tortoise.close_connections()

AUTH_USER_MODEL = "models.User"
TIMEZONE = "Asia/Kolkata"

JWT_SETTINGS = {
    "algorithm": "HS256",
    "access_token_expire_minutes": 15,
    "refresh_token_expire_days": 30,
}


MAIL_CONFIG = ConnectionConfig(
    MAIL_USERNAME=os.getenv("MAIL_USERNAME"),
    MAIL_PASSWORD=os.getenv("MAIL_PASSWORD"),
    MAIL_FROM=os.getenv("MAIL_USERNAME"),
    MAIL_PORT=int(os.getenv("MAIL_PORT", 587)),
    MAIL_SERVER=os.getenv("MAIL_SERVER", "smtp.gmail.com"),
    MAIL_FROM_NAME="Aegis Security Team",
    MAIL_STARTTLS=True,
    MAIL_SSL_TLS=False,
    USE_CREDENTIALS=True,
    VALIDATE_CERTS=True
)
def load_model(model_path):
    try:
        model = joblib.load(model_path)
        logger.info(f"Model loaded successfully from {model_path}")
        return model
    except Exception as e:
        logger.error(f"Error loading model: {e}")
        return None

BASE_MODEL= load_model(os.path.join(BASE_DIR, "phishing_model","Base_Ensemble.joblib"))
META_MODEL= load_model(os.path.join(BASE_DIR, "phishing_model","Meta_LR.joblib"))