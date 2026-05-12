import os
import httpx
from fastapi import APIRouter

router = APIRouter()

KYC_SVC_URL = os.getenv("KYC_SVC_URL", "http://kyc:3004")


@router.get("/status-breakdown")
async def kyc_status_breakdown():
    """Counts of KYC submissions by status, fetched from the KYC service."""
    try:
        async with httpx.AsyncClient(timeout=5) as client:
            resp = await client.get(f"{KYC_SVC_URL}/kyc/stats")
            resp.raise_for_status()
            data = resp.json().get("data", {})
    except Exception:
        data = {}

    return {
        "pending":       data.get("pending",       0),
        "processing":    data.get("processing",    0),
        "approved":      data.get("approved",      0),
        "rejected":      data.get("rejected",      0),
        "manual_review": data.get("manual_review", 0),
        "total":         data.get("total",         0),
    }
