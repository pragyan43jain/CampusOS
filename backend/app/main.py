"""
CampusOS backend.

Serves student VTOP data to the frontend via live scrapes of the VIT Chennai portal.
Production hardened for both local execution and Vercel serverless functions.
"""

from __future__ import annotations

import logging
import os
from typing import Any, Dict

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from starlette.exceptions import HTTPException as StarletteHTTPException

from app.routers import academics, analytics, auth, leetcode, lms, teams, unified_assignments
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

# Strict CORS allowlist for authorized CampusOS client deployments
ALLOWED_ORIGINS = [
    "https://campus-os-pi-three.vercel.app",
    "https://campus-o.netlify.app",
    "http://localhost:5173",
    "http://127.0.0.1:5173",
    "http://localhost:4173",
    "http://127.0.0.1:4173",
    "http://localhost:3000",
]
custom_origins = os.environ.get("CAMPUSOS_ALLOWED_ORIGINS", "")
if custom_origins:
    ALLOWED_ORIGINS.extend([o.strip() for o in custom_origins.split(",") if o.strip()])

app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_origin_regex=r"^https:\/\/campus-os(-[a-z0-9-]+)?\.vercel\.app$",
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS", "PATCH"],
    allow_headers=["*"],
)


@app.middleware("http")
async def normalize_api_route_middleware(request: Request, call_next):
    """
    Ensures routes work whether Vercel serverless proxy preserves or strips the /api prefix,
    or rewrites path to /api/index.py.
    """
    path = request.scope.get("path", "")
    # Check if a custom path query param was passed: e.g. ?__path=/api/vtop/captcha
    q_path = request.query_params.get("__path")
    if q_path:
        path = q_path
        request.scope["path"] = path

    # If path points to index or root due to rewrite, look for original path in edge proxy headers
    if path in ("/api/index.py", "/index.py", "/api/index", "/index", "/api", "/api/"):
        orig_path = (
            request.headers.get("x-invoke-path")
            or request.headers.get("x-matched-path")
            or request.headers.get("x-forwarded-uri")
            or request.headers.get("x-original-url")
            or request.headers.get("x-rewrite-url")
            or request.headers.get("x-real-path")
        )
        if orig_path and orig_path.split("?")[0] not in ("/api", "/api/", "/api/index.py", "/index.py"):
            path = orig_path.split("?")[0]
            request.scope["path"] = path

    # If path lacks /api prefix but targets our routers, normalize it
    if path and not path.startswith("/api"):
        prefixes = (
            "/vtop", "/academics", "/leetcode", "/lms", "/teams", "/assignments",
            "/health", "/analytics", "/od", "/calendar", "/student", "/courses",
            "/timetable", "/attendance", "/marks", "/faculty", "/exams",
        )
        if any(path.startswith(p) for p in prefixes):
            request.scope["path"] = f"/api{path}"

    # Normalize Authorization header (Bearer token) to X-Session-ID if not present
    headers_list = list(request.scope.get("headers", []))
    header_dict = {k.lower(): v for k, v in headers_list}
    if b"authorization" in header_dict and b"x-session-id" not in header_dict:
        auth_val = header_dict[b"authorization"].decode("latin1", errors="ignore").strip()
        if auth_val.lower().startswith("bearer "):
            token = auth_val[7:].strip().encode("latin1")
            headers_list.append((b"x-session-id", token))
            request.scope["headers"] = headers_list

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
    # Security (C10): Strip raw input and context to prevent credential/password echo
    sanitized_errors = []
    for err in exc.errors():
        sanitized_errors.append(
            {
                "type": err.get("type"),
                "loc": err.get("loc"),
                "msg": err.get("msg"),
            }
        )
    return JSONResponse(
        status_code=422,
        content={
            "success": False,
            "status": "validation_error",
            "message": "Invalid request payload or parameters.",
            "errors": sanitized_errors,
        },
    )


app.include_router(auth.router)
app.include_router(unified_assignments.router)
app.include_router(academics.router)
app.include_router(leetcode.router)
app.include_router(teams.router)
app.include_router(lms.router)
app.include_router(analytics.router)


from app.storage import load_store


@app.get("/")
@app.get("/api")
@app.get("/health")
@app.get("/api/health")
def root():
    """
    Health check endpoint.
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
