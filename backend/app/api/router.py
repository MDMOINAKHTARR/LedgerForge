from fastapi import APIRouter
from backend.app.api.endpoints import ingest, reconcile, exceptions, agents, evals, audit, agent_engineer, autopsy_endpoints, pipeline, notifications

api_router = APIRouter()

api_router.include_router(ingest.router, prefix="/ingest", tags=["Data Ingestion & Normalization"])
api_router.include_router(reconcile.router, prefix="/reconcile", tags=["Reconciliation Pipeline"])
api_router.include_router(exceptions.router, prefix="/exceptions", tags=["Human-in-the-Loop Exceptions"])
api_router.include_router(agents.router, prefix="/agents", tags=["Agent Management & Optimization"])
api_router.include_router(evals.router, prefix="/evals", tags=["Evaluation & Leaderboard"])
api_router.include_router(audit.router, prefix="", tags=["Audit Trail & Execution Trace"])
api_router.include_router(agent_engineer.router, prefix="", tags=["Autonomous Agent Engineer"])
api_router.include_router(autopsy_endpoints.router, prefix="", tags=["Agent Autopsy & Failure Analysis"])
api_router.include_router(pipeline.router, prefix="/pipeline", tags=["Full Integration Pipeline"])
api_router.include_router(notifications.router, prefix="", tags=["System Notifications"])



