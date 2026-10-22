"""
Pydantic schemas for BeltGuard AI conveyor belt monitoring backend.
"""

from typing import List, Optional, Dict, Any
from pydantic import BaseModel, Field
from datetime import datetime
from enum import Enum


class DefectSeverity(str, Enum):
    LOW = "LOW"
    MEDIUM = "MEDIUM"
    HIGH = "HIGH"
    CRITICAL = "CRITICAL"


class DefectType(str, Enum):
    SURFACE_GOUGE = "SURFACE_GOUGE"
    PUNCTURE = "PUNCTURE"
    SPLICE_SPLIT = "SPLICE_SPLIT"
    TEAR = "TEAR"
    EDGE_FRAY = "EDGE_FRAY"


class TelemetryIn(BaseModel):
    beltRunning: bool = True
    beltSpeedMps: float = Field(0.85, ge=0.0, description="Belt linear speed in m/s")
    beltRpm: float = Field(12.75, ge=0.0, description="Belt rotations per minute")
    revCount: int = Field(0, ge=0, description="Cumulative revolution count")
    laserBaselineCalibrated: bool = True
    scaleFactorMmPerPx: float = Field(0.22, gt=0.0)
    servoArmed: bool = True
    memoryFreeBytes: Optional[int] = None
    wifiRssi: Optional[int] = None
    tempDegC: Optional[float] = None


class TelemetryOut(TelemetryIn):
    timestamp: datetime = Field(default_factory=datetime.utcnow)
    id: Optional[int] = None


class DefectRecordIn(BaseModel):
    id: Optional[str] = None
    timestamp: Optional[int] = None
    revolution: int = 0
    phaseAngleDeg: float = Field(0.0, ge=0.0, le=360.0)
    distanceFromJointMm: float = Field(0.0, ge=0.0)
    laserDeviationPx: float = Field(..., gt=0.0)
    laserDeviationMm: Optional[float] = None
    widthMm: Optional[float] = None
    lengthMm: Optional[float] = None
    severity: DefectSeverity = DefectSeverity.MEDIUM
    confidence: float = Field(0.9, ge=0.0, le=1.0)
    isJointAssociated: bool = False
    defectType: DefectType = DefectType.SURFACE_GOUGE


class DefectRecordOut(DefectRecordIn):
    id: str
    marked: bool = False
    markedTimestamp: Optional[int] = None
    growthRateMmPerRev: Optional[float] = 0.0
    createdAt: datetime = Field(default_factory=datetime.utcnow)


class JointStatusOut(BaseModel):
    revolutionCount: int
    lastPulseTimestampMs: int
    timeSinceLastPulseMs: int
    revPeriodMs: int
    beltRpm: float
    beltSpeedMps: float
    currentPhaseDeg: float
    jointDefectsCount: int
    jointConditionRating: str
    spliceSafetyMarginPercent: float


class PredictiveMaintenanceTrendItem(BaseModel):
    revolution: int
    deviationMm: float
    timestamp: int


class PredictiveMaintenanceReport(BaseModel):
    dataSufficient: bool
    sampleCount: int
    criticalThresholdMm: float
    currentMaxDeviationMm: float
    degradationRateMmPerRev: float
    estimatedRevolutionsRemaining: int
    estimatedHoursRemaining: float
    confidenceScore: float
    warningMessage: str
    trends: List[PredictiveMaintenanceTrendItem]


class AIAnalysisRequest(BaseModel):
    contextNotes: Optional[str] = "Shift inspection request"
    includeRecentDefectsCount: Optional[int] = 10


class AIRecommendedAction(BaseModel):
    priority: str
    action: str
    timeframe: str


class JointConditionAnalysis(BaseModel):
    status: str
    spliceIntegrityRatingPercent: float
    riskDescription: str


class DegradationTrendAnalysis(BaseModel):
    pattern: str
    estimatedRulHours: str
    confidenceAssessment: str


class AIAnalysisResponse(BaseModel):
    summary: str
    observedDefects: List[str]
    jointCondition: JointConditionAnalysis
    degradationTrend: DegradationTrendAnalysis
    riskCategory: str
    recommendedActions: List[AIRecommendedAction]
    dataQualityNotes: str
    source: str = "gemini-3.8-flash"
    timestamp: datetime = Field(default_factory=datetime.utcnow)
