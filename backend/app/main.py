import time
import uvicorn
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from config import lifespan, DEBUG,EXTENSION_ID,logger
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse, RedirectResponse
from routes import router   
from fastapi_limiter.depends import RateLimiter

app = FastAPI(
    title="Aegis",
    version="1.0.0",
    description="A Privacy-First, AI-Driven Phishing URL Detector",
    lifespan=lifespan,
    debug=DEBUG
)

DEV_ORIGINS = [
    "*"
]

PROD_ORIGINS = [
    f"chrome-extension://{EXTENSION_ID}"
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=DEV_ORIGINS if DEBUG else PROD_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
if DEBUG:
    @app.get("/")
    def docs_redirect():
        return RedirectResponse("/docs")
    
app.include_router(router)

@app.middleware("http")
async def log_requests(request: Request, call_next):
    start_time = time.time()

    try:
        response = await call_next(request)
    except Exception as exc:
        logger.exception(
            "Unhandled exception | %s %s",
            request.method,
            request.url.path
        )
        raise exc

    duration = round(time.time() - start_time, 3)

    logger.info(
        "%s %s | Status=%s | Time=%ss | Client=%s",
        request.method,
        request.url.path,
        response.status_code,
        duration,
        request.client.host if request.client else "unknown"
    )

    return response

@app.exception_handler(RequestValidationError)
async def validation_exception_handler(request: Request, exc: RequestValidationError):
    logger.error(
        "Validation error | %s %s | Errors=%s | Body=%s",
        request.method,
        request.url.path,
        exc.errors(),
        exc.body
    )
    return JSONResponse(
        status_code=400,
        content={"body": "Unexpected error. Please check your input data."},
    )

if __name__ == "__main__":
    uvicorn.run("main:app", host="127.0.0.1", port=5000, reload=True)
