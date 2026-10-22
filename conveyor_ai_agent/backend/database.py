"""
SQLite Database connection and repository layer for BeltGuard AI backend.
"""

import sqlite3
import os
import json
import time
from typing import List, Optional, Dict, Any

DB_PATH = os.getenv("DB_PATH", os.path.join(os.path.dirname(__file__), "conveyor_agent.db"))


def get_db_connection() -> sqlite3.Connection:
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn


def init_db():
    conn = get_db_connection()
    cursor = conn.cursor()

    cursor.executescript("""
    CREATE TABLE IF NOT EXISTS telemetry (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
        belt_running BOOLEAN NOT NULL DEFAULT 1,
        belt_speed_mps REAL NOT NULL DEFAULT 0.85,
        belt_rpm REAL NOT NULL DEFAULT 12.75,
        rev_count INTEGER NOT NULL DEFAULT 0,
        laser_baseline_calibrated BOOLEAN NOT NULL DEFAULT 1,
        scale_factor_mm_per_px REAL NOT NULL DEFAULT 0.22,
        servo_armed BOOLEAN NOT NULL DEFAULT 1,
        memory_free_bytes INTEGER,
        wifi_rssi INTEGER,
        temp_deg_c REAL
    );

    CREATE TABLE IF NOT EXISTS defects (
        id TEXT PRIMARY KEY,
        timestamp INTEGER NOT NULL,
        revolution INTEGER NOT NULL,
        phase_angle_deg REAL NOT NULL,
        distance_from_joint_mm REAL NOT NULL,
        laser_deviation_px REAL NOT NULL,
        laser_deviation_mm REAL NOT NULL,
        width_mm REAL,
        length_mm REAL,
        severity TEXT NOT NULL,
        confidence REAL NOT NULL,
        is_joint_associated BOOLEAN NOT NULL DEFAULT 0,
        marked BOOLEAN NOT NULL DEFAULT 0,
        marked_timestamp INTEGER,
        defect_type TEXT NOT NULL,
        growth_rate_mm_per_rev REAL DEFAULT 0.0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS marking_logs (
        id TEXT PRIMARY KEY,
        defect_id TEXT NOT NULL,
        timestamp INTEGER NOT NULL,
        scheduled_delay_ms INTEGER NOT NULL,
        servo_angle INTEGER NOT NULL,
        pulse_duration_ms INTEGER NOT NULL,
        verified BOOLEAN NOT NULL DEFAULT 1
    );

    CREATE TABLE IF NOT EXISTS ai_reports (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
        source TEXT NOT NULL,
        risk_category TEXT NOT NULL,
        summary TEXT NOT NULL,
        raw_json TEXT NOT NULL
    );
    """)

    # Seed baseline telemetry if empty
    cursor.execute("SELECT COUNT(*) as cnt FROM telemetry")
    if cursor.fetchone()["cnt"] == 0:
        cursor.execute("""
        INSERT INTO telemetry (belt_running, belt_speed_mps, belt_rpm, rev_count, laser_baseline_calibrated, scale_factor_mm_per_px, servo_armed, memory_free_bytes, wifi_rssi, temp_deg_c)
        VALUES (1, 0.85, 12.75, 18, 1, 0.22, 1, 114280, -58, 44.2)
        """)

    # Seed sample realistic defect progression if empty
    cursor.execute("SELECT COUNT(*) as cnt FROM defects")
    if cursor.fetchone()["cnt"] == 0:
        now_ms = int(time.time() * 1000)
        sample_defects = [
            ("DEF-1001", now_ms - 145000, 12, 14.5, 165.0, 26.4, 5.81, 18.5, 42.0, "HIGH", 0.94, 1, 1, now_ms - 143500, "SPLICE_SPLIT", 0.0),
            ("DEF-1002", now_ms - 95000, 14, 145.2, 1650.0, 12.1, 2.66, 8.2, 14.0, "MEDIUM", 0.88, 0, 0, None, "SURFACE_GOUGE", 0.0),
            ("DEF-1003", now_ms - 42000, 16, 14.8, 168.0, 32.8, 7.22, 22.0, 58.0, "CRITICAL", 0.96, 1, 1, now_ms - 40500, "SPLICE_SPLIT", 0.35),
            ("DEF-1004", now_ms - 12000, 17, 280.0, 3180.0, 18.5, 4.07, 12.5, 28.0, "MEDIUM", 0.91, 0, 0, None, "TEAR", 0.0)
        ]
        cursor.executemany("""
        INSERT INTO defects (id, timestamp, revolution, phase_angle_deg, distance_from_joint_mm, laser_deviation_px, laser_deviation_mm, width_mm, length_mm, severity, confidence, is_joint_associated, marked, marked_timestamp, defect_type, growth_rate_mm_per_rev)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """, sample_defects)

    conn.commit()
    conn.close()


def insert_telemetry(data: Dict[str, Any]) -> int:
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("""
    INSERT INTO telemetry (belt_running, belt_speed_mps, belt_rpm, rev_count, laser_baseline_calibrated, scale_factor_mm_per_px, servo_armed, memory_free_bytes, wifi_rssi, temp_deg_c)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    """, (
        data.get("beltRunning", True),
        data.get("beltSpeedMps", 0.85),
        data.get("beltRpm", 12.75),
        data.get("revCount", 0),
        data.get("laserBaselineCalibrated", True),
        data.get("scaleFactorMmPerPx", 0.22),
        data.get("servoArmed", True),
        data.get("memoryFreeBytes"),
        data.get("wifiRssi"),
        data.get("tempDegC")
    ))
    new_id = cursor.lastrowid
    conn.commit()
    conn.close()
    return new_id


def get_latest_telemetry() -> Optional[Dict[str, Any]]:
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM telemetry ORDER BY id DESC LIMIT 1")
    row = cursor.fetchone()
    conn.close()
    return dict(row) if row else None


def insert_defect(defect: Dict[str, Any]) -> str:
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("""
    INSERT INTO defects (id, timestamp, revolution, phase_angle_deg, distance_from_joint_mm, laser_deviation_px, laser_deviation_mm, width_mm, length_mm, severity, confidence, is_joint_associated, marked, marked_timestamp, defect_type, growth_rate_mm_per_rev)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    """, (
        defect["id"],
        defect.get("timestamp", int(time.time() * 1000)),
        defect.get("revolution", 0),
        defect.get("phaseAngleDeg", 0.0),
        defect.get("distanceFromJointMm", 0.0),
        defect["laserDeviationPx"],
        defect["laserDeviationMm"],
        defect.get("widthMm"),
        defect.get("lengthMm"),
        defect.get("severity", "MEDIUM"),
        defect.get("confidence", 0.9),
        1 if defect.get("isJointAssociated") else 0,
        1 if defect.get("marked") else 0,
        defect.get("markedTimestamp"),
        defect.get("defectType", "SURFACE_GOUGE"),
        defect.get("growthRateMmPerRev", 0.0)
    ))
    conn.commit()
    conn.close()
    return defect["id"]


def get_all_defects(limit: int = 50, severity: Optional[str] = None) -> List[Dict[str, Any]]:
    conn = get_db_connection()
    cursor = conn.cursor()
    if severity:
        cursor.execute("SELECT * FROM defects WHERE severity = ? ORDER BY timestamp DESC LIMIT ?", (severity.upper(), limit))
    else:
        cursor.execute("SELECT * FROM defects ORDER BY timestamp DESC LIMIT ?", (limit,))
    rows = cursor.fetchall()
    conn.close()
    return [dict(r) for r in rows]


def insert_marking_log(log_entry: Dict[str, Any]):
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("""
    INSERT INTO marking_logs (id, defect_id, timestamp, scheduled_delay_ms, servo_angle, pulse_duration_ms, verified)
    VALUES (?, ?, ?, ?, ?, ?, ?)
    """, (
        log_entry["id"],
        log_entry["defectId"],
        log_entry.get("timestamp", int(time.time() * 1000)),
        log_entry.get("scheduledDelayMs", 0),
        log_entry.get("servoAngle", 65),
        log_entry.get("pulseDurationMs", 350),
        1 if log_entry.get("verified", True) else 0
    ))
    conn.commit()
    conn.close()


def insert_ai_report(source: str, risk_category: str, summary: str, report_dict: Dict[str, Any]):
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("""
    INSERT INTO ai_reports (source, risk_category, summary, raw_json)
    VALUES (?, ?, ?, ?)
    """, (source, risk_category, summary, json.dumps(report_dict)))
    conn.commit()
    conn.close()
