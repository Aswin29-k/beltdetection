"""
Integration tests for BeltGuard AI FastAPI backend endpoints.
"""

import pytest
import sys
import os
from fastapi.testclient import TestClient

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "../backend")))

from main import app

client = TestClient(app)


def test_health_endpoint():
    response = client.get("/health")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "ok"
    assert "markingArmed" in data


def test_telemetry_post_and_get():
    payload = {
        "beltRunning": True,
        "beltSpeedMps": 0.92,
        "beltRpm": 13.5,
        "revCount": 42,
        "laserBaselineCalibrated": True,
        "scaleFactorMmPerPx": 0.22,
        "servoArmed": True
    }
    post_res = client.post("/api/telemetry", json=payload)
    assert post_res.status_code == 200
    assert post_res.json()["success"] is True

    get_res = client.get("/api/telemetry")
    assert get_res.status_code == 200
    assert get_res.json()["belt_speed_mps"] == 0.92 or get_res.json()["beltSpeedMps"] == 0.92


def test_defects_and_deterministic_marking():
    defect_payload = {
        "id": "DEF-TEST-99",
        "revolution": 42,
        "phaseAngleDeg": 12.0,
        "distanceFromJointMm": 110.0,
        "laserDeviationPx": 35.0,
        "laserDeviationMm": 7.7,
        "severity": "CRITICAL",
        "confidence": 0.96,
        "isJointAssociated": True,
        "defectType": "SPLICE_SPLIT"
    }

    res = client.post("/api/defects", json=defect_payload)
    assert res.status_code == 201
    data = res.json()
    assert data["success"] is True
    # Critical defect must trigger marking
    assert data["markingTriggered"] is True


def test_marking_safety_lockout():
    # Disable marking
    dis_res = client.post("/api/marking/disable")
    assert dis_res.status_code == 200
    assert dis_res.json()["markingArmed"] is False

    # Attempt to post a critical defect while disarmed
    defect_payload = {
        "id": "DEF-TEST-DISARMED",
        "revolution": 43,
        "laserDeviationPx": 40.0,
        "laserDeviationMm": 8.8,
        "severity": "CRITICAL",
        "isJointAssociated": True
    }
    res = client.post("/api/defects", json=defect_payload)
    assert res.status_code == 201
    # Must NOT trigger marking because system is disarmed
    assert res.json()["markingTriggered"] is False

    # Re-arm
    en_res = client.post("/api/marking/enable")
    assert en_res.status_code == 200
    assert en_res.json()["markingArmed"] is True
