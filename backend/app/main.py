import uvicorn
from fastapi import FastAPI, Request
from config import lifespan, DEBUG
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from routes import router   
app = FastAPI(
    title="Aegis",
    version="1.0.0",
    description="A Privacy-First, AI-Driven Phishing URL Detector",
    lifespan=lifespan,
    debug=DEBUG
)


app.include_router(router)

@app.exception_handler(RequestValidationError)
async def validation_exception_handler(request: Request, exc: RequestValidationError):
    return JSONResponse(
        status_code=400,
        content={"detail": exc.errors()[0]['msg']} if not DEBUG else {"detail": exc.errors(), "body": exc.body},
    )

if __name__ == "__main__":
    uvicorn.run("main:app", host="127.0.0.1", port=5000, reload=True)
