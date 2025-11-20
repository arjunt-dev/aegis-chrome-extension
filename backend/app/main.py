import uvicorn
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from config import lifespan, DEBUG
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
    ""
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

@app.exception_handler(RequestValidationError)
async def validation_exception_handler(request: Request, exc: RequestValidationError):
    return JSONResponse(
        status_code=400,
        content={"detail": exc.errors()[0]['msg']} if not DEBUG else {"detail": exc.errors(), "body": exc.body},
    )

if __name__ == "__main__":
    uvicorn.run("main:app", host="127.0.0.1", port=5000, reload=True)
