export type DefectSeverity = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
export type DefectType = 'TEAR' | 'PUNCTURE' | 'SPLICE_SPLIT' | 'SURFACE_GOUGE' | 'EDGE_FRAY';

export interface DefectItem {
  id: string;
  timestamp: number;
  revolution: number;
  phaseAngleDeg: number;
  distanceFromJointMm: number;
  laserDeviationPx: number;
  laserDeviationMm: number;
  widthMm: number;
  lengthMm: number;
  severity: DefectSeverity;
  confidence: number;
  isJointAssociated: boolean;
  marked: boolean;
  markedTimestamp?: number;
  defectType: DefectType;
  growthRateMmPerRev?: number;
}

export interface TelemetryData {
  timestamp: number;
  beltRunning: boolean;
  beltSpeedMps: number;
  beltRpm: number;
  revCount: number;
  lastJointTimestamp: number;
  laserBaselineCalibrated: boolean;
  scaleFactorMmPerPx: number;
  cameraFps: number;
  servoArmed: boolean;
  markingCooldownMs: number;
  markingNozzleDistanceMm: number;
  memoryFreeBytes: number;
  wifiRssi: number;
  tempDegC: number;
}

export interface JointStatusData {
  revolutionCount: number;
  lastPulseTimestamp: number;
  timeSinceLastPulseMs: number;
  revPeriodMs: number;
  beltRpm: number;
  beltSpeedMps: number;
  currentPhaseDeg: number;
  jointDefectsCount: number;
  jointConditionRating: string;
  spliceSafetyMarginPercent: number;
}

export interface PredictiveMaintenanceData {
  dataSufficient: boolean;
  sampleCount: number;
  criticalThresholdMm: number;
  currentMaxDeviationMm: number;
  degradationRateMmPerRev: number;
  estimatedRevolutionsRemaining: number;
  estimatedHoursRemaining: number;
  confidenceScore: number;
  warningMessage: string;
  trends: Array<{
    revolution: number;
    deviationMm: number;
    timestamp: number;
  }>;
}

export interface AIAnalysisReport {
  summary: string;
  observedDefects: string[];
  jointCondition: {
    status: string;
    spliceIntegrityRatingPercent: number;
    riskDescription: string;
  };
  degradationTrend: {
    pattern: string;
    estimatedRulHours: string;
    confidenceAssessment: string;
  };
  riskCategory: 'LOW' | 'MODERATE' | 'HIGH' | 'CRITICAL_URGENT';
  recommendedActions: Array<{
    priority: string;
    action: string;
    timeframe: string;
  }>;
  dataQualityNotes: string;
}
