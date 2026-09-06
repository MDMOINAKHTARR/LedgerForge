import uuid
from fastapi import APIRouter, UploadFile, File, HTTPException
from backend.app.models.pydantic_models import IngestionResponseSchema
from backend.app.services.ingestion import DataIngestionService

router = APIRouter()

@router.post("", response_model=IngestionResponseSchema)
@router.post("/", response_model=IngestionResponseSchema)
async def ingest_bank_and_ledger_csvs(
    bank_file: UploadFile = File(...),
    ledger_file: UploadFile = File(...)
):
    """
    POST /ingest API Endpoint.
    Ingests and normalizes raw Bank CSV and Company Ledger CSV statements.
    Returns clean normalized transactions, invalid row segregations, statistics, and validation errors.
    """
    try:
        bank_bytes = await bank_file.read()
        ledger_bytes = await ledger_file.read()
        
        batch_id = f"batch_{uuid.uuid4().hex[:8]}"
        
        ingestion_result = DataIngestionService.ingest_files(
            bank_bytes=bank_bytes,
            ledger_bytes=ledger_bytes,
            batch_id=batch_id
        )
        
        return ingestion_result
        
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Ingestion failed: {str(e)}")
