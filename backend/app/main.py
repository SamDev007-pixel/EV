from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.api.routes import router

app = FastAPI(
    title="Intelligent EV Charging & Resource Management System",
    description="Classical Artificial Intelligence decision-making engine for EV charging, grid load management, and multi-agent coordination.",
    version="1.0.0"
)

# Enable CORS for frontend development server
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(router)


@app.get("/")
def root():
    return {
        "system": "Intelligent EV Charging & Resource Management System",
        "status": "OPERATIONAL",
        "ai_foundation": "Classical artificial intelligence: heuristic search, constraint satisfaction, logical inference and game theory",
        "phase": "Phase 1 - Core Domain Models & PEAS Environment"
    }
