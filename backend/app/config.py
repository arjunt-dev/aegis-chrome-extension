import json

from apscheduler.schedulers.asyncio import AsyncIOScheduler
from contextlib import asynccontextmanager
from fastapi import FastAPI
import joblib
from pydantic import SecretStr
from tortoise.contrib.fastapi import RegisterTortoise
from dotenv import load_dotenv
import os
from app.tasks import cleanup_expired_otps
from fastapi_mail import ConnectionConfig
from app.logging_config import setup_logger,logger

load_dotenv()

scheduler = AsyncIOScheduler()
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DEBUG = os.getenv("DEBUG", "True") == "True"
SECRET_KEY = os.getenv("SECRET_KEY") 
DB_URL = f"sqlite://{os.path.join(BASE_DIR, 'db.sqlite3')}"
EXTENSION_ID="phaapmkjnafbdnnbimibbffdpephgmmh"

TORTOISE_ORM = {
    "connections": {"default": DB_URL},
    "apps": {
        "models": {
            "models": ["app.models", "aerich.models"],
            "default_connection": "default",
        },
    },
}

@asynccontextmanager
async def lifespan(app: FastAPI):
    """
    Manages application startup and shutdown events.
    Uses RegisterTortoise (Tortoise ORM 1.x) which injects TortoiseContext
    per-request via ASGI middleware, replacing the old global Tortoise.init() pattern.
    """
    setup_logger()
    logger.info("Starting up... Initializing database.")
    async with RegisterTortoise(
        app=app,
        config=TORTOISE_ORM,
        generate_schemas=True,
    ):
        logger.info("Database initialized.")
        scheduler.add_job(
            cleanup_expired_otps,
            "interval",
            minutes=5,
            id="otp_cleanup_job",
            replace_existing=True,
            max_instances=1,
        )
        scheduler.start()
        yield
        scheduler.shutdown()
        logger.info("Shutting down... Closing database connections.")

AUTH_USER_MODEL = "models.User"
TIMEZONE = "Asia/Kolkata"

JWT_SETTINGS = {
    "algorithm": "HS256",
    "access_token_expire_minutes": 15,
    "refresh_token_expire_days": 30,
}


MAIL_CONFIG = ConnectionConfig(
    MAIL_USERNAME = os.getenv("MAIL_USERNAME", ""),
    MAIL_PASSWORD = SecretStr(os.getenv("MAIL_PASSWORD", "")),
    MAIL_FROM = os.getenv("MAIL_USERNAME", ""),
    MAIL_PORT = int(os.getenv("MAIL_PORT", 587)),
    MAIL_SERVER = os.getenv("MAIL_SERVER", "smtp.gmail.com"),
    MAIL_FROM_NAME = "Aegis Security Team",
    MAIL_STARTTLS = True,
    MAIL_SSL_TLS = False,
    USE_CREDENTIALS = True,
    VALIDATE_CERTS = True
)
def load_model(model_path):
    try:
        model = joblib.load(model_path)
        logger.info(f"Model loaded successfully from {model_path}")
        return model
    except Exception as e:
        logger.error(f"Error loading model: {e}")
        return None

def load_data(json_path):
    try:
        with open(json_path, "r") as f:
            data = json.load(f)
            brand_data = data.get("brands", {})
            suspicious_keywords = set(data.get("suspicious_keywords", []))
            url_shorteners = set(data.get("url_shorteners", []))
            popular_tlds = set(data.get("tlds", []))

        return {
            "brand_data": brand_data,
            "suspicious_keywords": suspicious_keywords,
            "url_shorteners": url_shorteners,
            "popular_tlds": popular_tlds,
        }
    except Exception as e:
        logger.error(f"Error loading JSON data: {e}")
        return {
            "brand_data": {},
            "suspicious_keywords": set(),
            "url_shorteners": set(),
            "popular_tlds": set(),
        }
BASE_MODEL = load_model(os.path.join(BASE_DIR, "phishing_model","aegis_ensemble_model.joblib"))
MAX_URL_LENGTH = 2048
data_json_path = os.path.join(BASE_DIR, "phishing_model", "data.json")
DATA_JSON = load_data(data_json_path)
MIN_BRAND_LEN_FOR_FUZZY = 5