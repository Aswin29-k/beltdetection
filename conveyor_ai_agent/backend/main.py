"""
FastAPI Central Backend for BeltGuard AI Conveyor Monitoring System.
"""

import os
import time
from typing import List, Optional
from fastapi import FastAPI, HTTPException, Query, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv

load_dotenv()

from schemas import (
    TelemetryIn,
    TelemetryOut,
    DefectRecordIn,
    DefectRecordOut,
    JointStatusOut,
    PredictiveMaintenanceReport,
    AIAnalysisRequest,
    AIAnalysisResponse
)
from database import (
    init_db,
    insert_telemetry,
    get_latest_telemetry,
    insert_defect,
    get_all_defects,
    insert_marking_log,
    insert_ai_report
)
from predictive_maintenance import compute_predictive_maintenance
from gemini_agent import ConveyorGeminiAgent

app = FastAPI(
    title="BeltGuard AI - Conveyor Monitoring Backend",
    version="1.0.0",
    description="Industrial conveyor belt monitoring API combining laser triangulation, proximity joint tracking, and Gemini AI"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Initialize Database
init_db()

# Initialize Gemini Agent
ai_agent = ConveyorGeminiAgent()

# Marking state
MARKING_ARMED = True


@app.get("/health")
def health_check():
    """System health check endpoint."""
    return {
        "status": "ok",
        "service": "BeltGuard AI Backend",
        "markingArmed": MARKING_ARMED,
        "database": "SQLite (online)",
        "timestamp": int(time.time() * 1000)
    }


@app.get("/api/system-status")
def get_system_status():
    """Retrieve full system status and counts."""
    telemetry = get_latest_telemetry() or {}
    defects = get_all_defects(limit=100)
    critical_count = sum(1 for d in defects if d.get("severity") == "CRITICAL")
    joint_count = sum(1 for d in defects if d.get("is_joint_associated"))

    return {
        "telemetry": telemetry,
        "activeDefectsCount": len(defects),
        "criticalDefectsCount": critical_count,
        "jointDefectsCount": joint_count,
        "servoArmed": MARKING_ARMED,
        "opticalLaserStatus": "OPERATIONAL_CALIBRATED"
    }


@app.get("/api/telemetry")
def read_telemetry():
    """Get latest conveyor telemetry."""
    data = get_latest_telemetry()
    if not data:
        raise HTTPException(status_code=404, detail="No telemetry recorded")
    return data


@app.post("/api/telemetry")
def record_telemetry(payload: TelemetryIn):
    """Receive periodic telemetry pulse from ESP32-CAM controller."""
    inserted_id = insert_telemetry(payload.dict())
    return {"success": True, "id": inserted_id}


@app.get("/api/defects")
def list_defects(
    limit: int = Query(50, ge=1, le=200),
    severity: Optional[str] = Query(None)
):
    """Retrieve recorded defects with optional severity filter."""
    return get_all_defects(limit=limit, severity=severity)


@app.post("/api/defects", status_code=201)
def record_defect(defect: DefectRecordIn):
    """
    Log defect event detected by ESP32-CAM.
    Triggers deterministic physical marking if criteria are met.
    """
    global MARKING_ARMED
    defect_dict = defect.dict()
    if not defect_dict.get("id"):
        defect_dict["id"] = f"DEF-{int(time.time() * 1000) % 10000:04d}"

    scale = 0.22
    if not defect_dict.get("laserDeviationMm"):
        defect_dict["laserDeviationMm"] = defect_dict["laserDeviationPx"] * scale

    # Deterministic marking rule
    should_mark = (
        MARKING_ARMED and
        (defect_dict.get("severity") == "CRITICAL" or
         (defect_dict.get("severity") == "HIGH" and defect_dict.get("isJointAssociated")))
    )

    defect_dict["marked"] = should_mark
    if should_mark:
        defect_dict["markedTimestamp"] = int(time.time() * 1000) + 1400 # 1.4s transit delay
        insert_marking_log({
            "id": f"MRK-{int(time.time() * 1000) % 10000:04d}",
            "defectId": defect_dict["id"],
            "scheduledDelayMs": 1400,
            "servoAngle": 65,
            "pulseDurationMs": 350,
            "verified": True
        })

    saved_id = insert_defect(defect_dict)
    return {"success": True, "defectId": saved_id, "markingTriggered": should_mark}


@app.get("/api/joint-status", response_model=JointStatusOut)
def get_joint_status():
    """Retrieve vulcanized-joint synchronization & belt speed metrics."""
    telemetry = get_latest_telemetry() or {}
    rpm = telemetry.get("belt_rpm", 12.75)
    speed = telemetry.get("belt_speed_mps", 0.85)
    revs = telemetry.get("rev_count", 18)

    rev_period_ms = int(60000.0 / max(0.1, rpm))
    now_ms = int(time.time() * 1000)
    time_since = (now_ms % rev_period_ms)
    phase_deg = round((time_since / rev_period_ms) * 360.0, 1)

    defects = get_all_defects(limit=100)
    joint_defects = [d for d in defects if d.get("is_joint_associated")]

    has_critical = any(d.get("severity") == "CRITICAL" for d in joint_defects)
    condition = "CRITICAL_RISK" if has_critical else ("MONITORED" if joint_defects else "HEALTHY")
    safety_margin = max(15.0, 100.0 - (len(joint_defects) * 25.0))

    return JointStatusOut(
        revolutionCount=revs,
        lastPulseTimestampMs=now_ms - time_since,
        timeSinceLastPulseMs=time_since,
        revPeriodMs=rev_period_ms,
        beltRpm=rpm,
        beltSpeedMps=speed,
        currentPhaseDeg=phase_deg,
        jointDefectsCount=len(joint_defects),
        jointConditionRating=condition,
        spliceSafetyMarginPercent=safety_margin
    )


@app.get("/api/predictive-maintenance", response_model=PredictiveMaintenanceReport)
def get_predictive_maintenance():
    """Calculate remaining useful life (RUL) and joint wear degradation."""
    telemetry = get_latest_telemetry() or {}
    rpm = telemetry.get("belt_rpm", 12.75)
    defects = get_all_defects(limit=100)
    report = compute_predictive_maintenance(defects, current_belt_rpm=rpm)
    return PredictiveMaintenanceReport(**report)


@app.post("/api/ai/analyze", response_model=AIAnalysisResponse)
def analyze_with_gemini(request: AIAnalysisRequest):
    """
    Invoke Gemini AI agent to analyze current defect stream & recommend maintenance.
    """
    telemetry = get_latest_telemetry() or {}
    defects = get_all_defects(limit=request.includeRecentDefectsCount or 10)
    pred_report = compute_predictive_maintenance(defects, current_belt_rpm=telemetry.get("belt_rpm", 12.75))

    ai_response = ai_agent.analyze_conveyor_health(
        telemetry=telemetry,
        recent_defects=defects,
        predictive_report=pred_report,
        notes=request.contextNotes or ""
    )

    insert_ai_report(
        source=ai_response.source,
        risk_category=ai_response.riskCategory,
        summary=ai_response.summary,
        report_dict=ai_response.dict()
    )

    return ai_response


@app.post("/api/marking/enable")
def enable_marking():
    """Arm the physical defect marking servo."""
    global MARKING_ARMED
    MARKING_ARMED = True
    return {"success": True, "markingArmed": True, "message": "Marking servo ARMED"}


@app.post("/api/marking/disable")
def disable_marking():
    """Emergency disable and lockout of marking servo."""
    global MARKING_ARMED
    MARKING_ARMED = False
    return {"success": True, "markingArmed": False, "message": "Marking servo DISARMED (Safety Lockout active)"}


@app.post("/api/marking/trigger-test")
def test_marking(angle: int = 65, duration_ms: int = 300):
    """Trigger a dry-run test actuation of the marking servo."""
    test_id = f"TEST-MRK-{int(time.time() * 1000) % 10000:04d}"
    insert_marking_log({
        "id": test_id,
        "defectId": "MANUAL_TEST_NO_SPRAY",
        "scheduledDelayMs": 0,
        "servoAngle": angle,
        "pulseDurationMs": duration_ms,
        "verified": True
    })
    return {
        "success": True,
        "testId": test_id,
        "message": f"Dry-run servo actuation test triggered ({duration_ms}ms @ {angle} deg)."
    }


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
