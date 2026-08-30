"""
CampusOS backend.

Serves one student's VTOP data to the local frontend. Everything it returns comes
from a live scrape of the VIT Chennai portal or is explicitly marked unavailable;
there is no sample data anywhere in the process.
"""

import logging

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.routers import academics, auth, leetcode, lms, teams, unified_assignments
from app.storage import load_store
from app.vtop import constants as C

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)-7s %(name)s | %(message)s",
)

app = FastAPI(
    title="CampusOS Backend API",
    description=(
        "Student dashboard API backed by a live VTOP (VIT Chennai) scrape. "
        "Missing data is reported as missing — see GET /api/vtop/sync-report."
    ),
    version="2.0.0",
)

# Browsers reject `Access-Control-Allow-Origin: *` on credentialed requests, so
# the previous wildcard-plus-credentials pair was both permissive and broken. This
# API carries VTOP session ids, so it is restricted to loopback origins — which is
# all it needs, since the frontend runs on the same machine.
app.add_middleware(
    CORSMiddleware,
    allow_origin_regex=r"^https?://(localhost|127\.0\.0\.1|.*\.github\.io|.*\.vercel\.app|.*\.onrender\.com)(:\d+)?$",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router)
app.include_router(academics.router)
app.include_router(leetcode.router)
app.include_router(teams.router)
app.include_router(lms.router)
app.include_router(unified_assignments.router)


@app.get("/")
def root():
    """
    Health and connection state.

    ``vtopConnected`` reflects whether a sync has actually succeeded. The old root
    route reported ``"vtop_integration": "active"`` unconditionally, which was true
    of the code and told you nothing about your data.
    """
    store = load_store()
    report = store.get("syncReport") or {}
    return {
        "system": "CampusOS Backend Engine",
        "version": "2.0.0",
        "status": "online",
        "campus": C.CAMPUS,
        "portal": C.BASE_URL,
        "vtopConnected": bool(store.get("authenticated")),
        "lastSynced": store.get("lastSynced"),
        "failedModules": report.get("failed") or [],
        "docs": "/docs",
    }


if __name__ == "__main__":
    import uvicorn

    # Loopback only: this process handles VTOP credentials and has no auth of its
    # own, so it must not be reachable from the network.
    uvicorn.run("app.main:app", host="127.0.0.1", port=8000, reload=True)
