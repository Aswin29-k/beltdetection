-- BeltGuard AI - SQLite / MySQL Schema
-- Supports prototype SQLite and migration to enterprise MySQL/PostgreSQL

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

CREATE TABLE IF NOT EXISTS joint_events (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    timestamp INTEGER NOT NULL,
    revolution INTEGER NOT NULL,
    period_ms INTEGER NOT NULL,
    calculated_speed_mps REAL NOT NULL
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

-- Optimization indexes
CREATE INDEX IF NOT EXISTS idx_defects_timestamp ON defects(timestamp);
CREATE INDEX IF NOT EXISTS idx_defects_joint ON defects(is_joint_associated);
CREATE INDEX IF NOT EXISTS idx_defects_severity ON defects(severity);
CREATE INDEX IF NOT EXISTS idx_defects_rev ON defects(revolution);
CREATE INDEX IF NOT EXISTS idx_telemetry_timestamp ON telemetry(timestamp);
