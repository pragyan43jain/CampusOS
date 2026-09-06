"""
CampusOS backend.

Serves student VTOP data to the frontend via live scrapes of the VIT Chennai portal.
Production hardened for both local execution and Vercel serverless functions.
"""

from __future__ import annotations

import logging
from typing import Any, Dict

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from starlette.exceptions import HTTPException as StarletteHTTPException

from app.routers import academics, auth, leetcode, lms, teams, unified_assignments
from app.storage import load_store
from app.vtop import constants as C

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)-7s %(name)s | %(message)s",
)
logger = logging.getLogger("campusos.main")

app = FastAPI(
    title="CampusOS Backend API",
    description=(
        "Student dashboard API backed by a live VTOP (VIT Chennai) scrape. "
        "Missing data is reported as missing — see GET /api/vtop/sync-report."
    ),
    version="2.0.0",
)

# Robust CORS middleware supporting local preview, Vercel deployments, and custom domains
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "https://campus-o.netlify.app",
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "http://localhost:4173",
        "http://127.0.0.1:4173",
        "http://localhost:3000",
    ],
    allow_origin_regex=r"^https?://.*$",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.middleware("http")
async def normalize_api_route_middleware(request: Request, call_next):
    """
    Ensures routes work whether Vercel serverless proxy preserves or strips the /api prefix.
    """
    path = request.scope.get("path", "")
    # If path lacks /api prefix but targets our routers, normalize it
    if path and not path.startswith("/api"):
        prefixes = ("/vtop", "/academics", "/leetcode", "/lms", "/teams", "/assignments", "/health")
        if any(path.startswith(p) for p in prefixes):
            request.scope["path"] = f"/api{path}"
    return await call_next(request)


# Global Exception Handlers to guarantee valid JSON responses and prevent FUNCTION_INVOCATION_FAILED
@app.exception_handler(Exception)
async def global_unhandled_exception_handler(request: Request, exc: Exception):
    logger.exception("[Serverless Unhandled Exception] %s %s: %s", request.method, request.url.path, exc)
    return JSONResponse(
        status_code=500,
        content={
            "success": False,
            "status": "error",
            "message": f"An unexpected server error occurred: {str(exc)}",
            "errorType": type(exc).__name__,
            "path": request.url.path,
        },
    )


@app.exception_handler(StarletteHTTPException)
async def http_exception_handler(request: Request, exc: StarletteHTTPException):
    return JSONResponse(
        status_code=exc.status_code,
        content={
            "success": False,
            "status": "error",
            "detail": exc.detail,
            "message": str(exc.detail),
            "statusCode": exc.status_code,
        },
    )


@app.exception_handler(RequestValidationError)
async def validation_exception_handler(request: Request, exc: RequestValidationError):
    return JSONResponse(
        status_code=422,
        content={
            "success": False,
            "status": "validation_error",
            "message": "Invalid request payload or parameters.",
            "errors": exc.errors(),
        },
    )


app.include_router(auth.router)
app.include_router(academics.router)
app.include_router(leetcode.router)
app.include_router(teams.router)
app.include_router(lms.router)
app.include_router(unified_assignments.router)


@app.get("/")
@app.get("/health")
@app.get("/api/health")
def root():
    """
    Health and connection state endpoint.
    """
    store = load_store()
    report = store.get("syncReport") or {}
    return {
        "status": "ok",
        "system": "CampusOS Backend Engine",
        "version": "2.0.0",
        "campus": C.CAMPUS,
        "portal": C.BASE_URL,
        "vtopConnected": bool(store.get("authenticated")),
        "lastSynced": store.get("lastSynced"),
        "failedModules": report.get("failed") or [],
        "docs": "/docs",
    }


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("app.main:app", host="127.0.0.1", port=8000, reload=True)
