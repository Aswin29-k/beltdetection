"""
Gemini AI Agent integration for Conveyor Belt Diagnostic & Reliability Analysis.
Uses the official Google Gen AI SDK (`google-genai`) with deterministic rule fallback.
"""

import os
import json
import logging
from typing import Dict, Any, List, Optional
from schemas import AIAnalysisResponse, JointConditionAnalysis, DegradationTrendAnalysis, AIRecommendedAction

logger = logging.getLogger("gemini_agent")

MODEL_ID = os.getenv("GEMINI_MODEL", "gemini-3.8-flash")


class ConveyorGeminiAgent:
    def __init__(self, api_key: Optional[str] = None):
        self.api_key = api_key or os.getenv("GEMINI_API_KEY", "AIzaSyCQ0ianbN6KLXY_uU_w2h3C-uXGEZ2I0W0")
        self.client = None
        self._init_client()

    def _init_client(self):
        try:
            from google import genai
            if self.api_key:
                self.client = genai.Client(api_key=self.api_key)
                logger.info(f"Initialized Google GenAI Client with model {MODEL_ID}")
        except Exception as e:
            logger.warning(f"Could not initialize google-genai SDK ({e}). Fallback engine will be used.")
            self.client = None

    def analyze_conveyor_health(
        self,
        telemetry: Dict[str, Any],
        recent_defects: List[Dict[str, Any]],
        predictive_report: Dict[str, Any],
        notes: str = ""
    ) -> AIAnalysisResponse:
        """
        Analyze conveyor state using Gemini API with structured JSON output,
        or gracefully fall back to deterministic rule engine if unavailable.
        """
        context_payload = {
            "telemetry": {
                "beltSpeedMps": telemetry.get("belt_speed_mps") or telemetry.get("beltSpeedMps"),
                "beltRpm": telemetry.get("belt_rpm") or telemetry.get("beltRpm"),
                "revolutionCount": telemetry.get("rev_count") or telemetry.get("revCount"),
                "servoArmed": telemetry.get("servo_armed") or telemetry.get("servoArmed"),
                "tempDegC": telemetry.get("temp_deg_c") or telemetry.get("tempDegC")
            },
            "recentDefects": recent_defects,
            "predictiveMetrics": predictive_report,
            "operatorNotes": notes
        }

        if self.client:
            try:
                system_instruction = (
                    "You are a Senior Predictive Maintenance and Reliability Engineer specializing in "
                    "heavy-duty industrial conveyor systems (DIN 22102, ISO 15236, CEMA). "
                    "Analyze the provided laser triangulation defects and vulcanized joint tracking records. "
                    "Provide an authoritative, risk-graded reliability evaluation. "
                    "Distinguish between cosmetic superficial top-cover wear and dangerous carcass/splice cord separation. "
                    "Never invent measurements. Adhere strictly to the requested JSON response schema."
                )

                prompt = (
                    f"Conveyor Inspection Data:\n{json.dumps(context_payload, indent=2)}\n\n"
                    "Generate a comprehensive reliability evaluation matching the required schema."
                )

                # Call Gemini with structured JSON schema
                response = self.client.models.generate_content(
                    model=MODEL_ID,
                    contents=prompt,
                    config={
                        "system_instruction": system_instruction,
                        "response_mime_type": "application/json",
                        "response_schema": AIAnalysisResponse
                    }
                )

                if response and response.text:
                    parsed = json.loads(response.text.strip())
                    return AIAnalysisResponse(**parsed)

            except Exception as ex:
                logger.error(f"Gemini API request failed: {ex}. Invoking deterministic fallback.")

        # Deterministic Rule-Based Fallback
        return self._generate_rule_based_fallback(telemetry, recent_defects, predictive_report)

    def _generate_rule_based_fallback(
        self,
        telemetry: Dict[str, Any],
        recent_defects: List[Dict[str, Any]],
        predictive_report: Dict[str, Any]
    ) -> AIAnalysisResponse:
        """Deterministic safety-rule fallback compliant with DIN 22102."""
        critical_defects = [
            d for d in recent_defects
            if (d.get("severity") == "CRITICAL" or float(d.get("laser_deviation_mm") or d.get("laserDeviationMm") or 0.0) >= 6.0)
        ]
        joint_critical = [
            d for d in critical_defects
            if d.get("is_joint_associated") or d.get("isJointAssociated")
        ]

        if joint_critical:
            summary = (
                "DETERMINISTIC FALLBACK: Urgent vulcanized splice delamination detected. "
                "Laser deflection exceeds 6.0mm carcass safety threshold near the splice seam."
            )
            risk = "CRITICAL_URGENT"
            joint_status = "SPLICE_SEPARATION_HAZARD"
            integrity = 35.0
            joint_risk = "Step-splice peeling or tensile cord rupture observed. High risk of catastrophic belt parting under dynamic tension."
            actions = [
                AIRecommendedAction(priority="P1 - IMMEDIATE", action="Halt conveyor safely at next scheduled shift transition.", timeframe="Within 2 hours"),
                AIRecommendedAction(priority="P1 - IMMEDIATE", action="Inspect marked spray point at flagged splice seam for cord fraying.", timeframe="Immediate"),
                AIRecommendedAction(priority="P2 - ESSENTIAL", action="Prepare cold/hot vulcanizing kit for re-splicing.", timeframe="Before restart")
            ]
        elif critical_defects:
            summary = (
                "DETERMINISTIC FALLBACK: Severe localized carcass puncture/gouge detected along belt body. "
                "Immediate visual verification required."
            )
            risk = "HIGH"
            joint_status = "MONITORED"
            integrity = 75.0
            joint_risk = "Splice integrity is stable, but body puncture threatens idler roll damage."
            actions = [
                AIRecommendedAction(priority="P2 - HIGH", action="Inspect marked body defect during shift stop.", timeframe="Within 8 hours"),
                AIRecommendedAction(priority="P3 - ROUTINE", action="Verify scrapers and transfer chute skirts for trapped tramp iron.", timeframe="Next 24 hours")
            ]
        else:
            summary = (
                "DETERMINISTIC FALLBACK: Conveyor running within nominal operational thresholds. "
                "Laser triangulation shows stable surface geometry with minor superficial wear."
            )
            risk = "LOW"
            joint_status = "HEALTHY"
            integrity = 92.0
            joint_risk = "Normal tensile joint flexure under rated speed."
            actions = [
                AIRecommendedAction(priority="P4 - SCHEDULED", action="Clean ESP32-CAM optical window and laser shroud.", timeframe="Weekly"),
                AIRecommendedAction(priority="P4 - SCHEDULED", action="Verify SG90 spray marker canister pressure and paint level.", timeframe="Weekly")
            ]

        rul_hours = str(predictive_report.get("estimatedHoursRemaining", "N/A")) + " hrs"

        return AIAnalysisResponse(
            summary=summary,
            observedDefects=[
                f"Rev {d.get('revolution', 0)}: {d.get('defect_type') or d.get('defectType')} "
                f"({float(d.get('laser_deviation_mm') or d.get('laserDeviationMm') or 0.0):.2f} mm dev)"
                for d in recent_defects[:5]
            ] or ["No active defects detected in recent buffer"],
            jointCondition=JointConditionAnalysis(
                status=joint_status,
                spliceIntegrityRatingPercent=integrity,
                riskDescription=joint_risk
            ),
            degradationTrend=DegradationTrendAnalysis(
                pattern=f"Wear rate: {predictive_report.get('degradationRateMmPerRev', 0.0):.3f} mm/rev",
                estimatedRulHours=rul_hours,
                confidenceAssessment=f"Confidence: {predictive_report.get('confidenceScore', 0.5):.2f}"
            ),
            riskCategory=risk,
            recommendedActions=actions,
            dataQualityNotes="Generated by local deterministic rule engine. Autonomous marking controller operates independently.",
            source="deterministic-rule-engine"
        )
