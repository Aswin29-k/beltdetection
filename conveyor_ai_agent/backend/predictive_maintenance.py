"""
Predictive maintenance and Remaining Useful Life (RUL) estimation engine.
Implements degradation trend analysis with data sufficiency validation.
"""

from typing import List, Dict, Any, Optional
import math


def compute_predictive_maintenance(
    defects: List[Dict[str, Any]],
    current_belt_rpm: float = 12.75,
    critical_threshold_mm: float = 8.0,
    min_required_revolutions: int = 3
) -> Dict[str, Any]:
    """
    Calculate joint-specific degradation trends and remaining useful life.
    Enforces strict statistical data sufficiency guards.
    """
    # Filter for joint defects or splice split candidates
    joint_defects = [
        d for d in defects
        if d.get("is_joint_associated") or d.get("isJointAssociated")
    ]
    joint_defects.sort(key=lambda x: x.get("revolution", 0))

    sample_count = len(joint_defects)
    unique_revs = len(set(d.get("revolution", 0) for d in joint_defects))

    # Guard: Check data sufficiency
    if sample_count < 2 or unique_revs < min_required_revolutions:
        current_max = max((d.get("laser_deviation_mm") or d.get("laserDeviationMm") or 0.0) for d in defects) if defects else 1.2
        return {
            "dataSufficient": False,
            "sampleCount": sample_count,
            "criticalThresholdMm": critical_threshold_mm,
            "currentMaxDeviationMm": round(current_max, 2),
            "degradationRateMmPerRev": 0.0,
            "estimatedRevolutionsRemaining": 0,
            "estimatedHoursRemaining": 0.0,
            "confidenceScore": 0.35,
            "warningMessage": (
                f"INSUFFICIENT_DATA: Only {unique_revs} unique revolutions recorded "
                f"(minimum {min_required_revolutions} required). Trend extrapolation withheld to prevent false alarms."
            ),
            "trends": [
                {
                    "revolution": d.get("revolution", 0),
                    "deviationMm": d.get("laser_deviation_mm") or d.get("laserDeviationMm") or 0.0,
                    "timestamp": d.get("timestamp", 0)
                }
                for d in joint_defects
            ]
        }

    # Extract revolution vs deviation series
    revs = [d.get("revolution", 0) for d in joint_defects]
    deviations = [
        float(d.get("laser_deviation_mm") or d.get("laserDeviationMm") or 0.0)
        for d in joint_defects
    ]

    # Linear regression: deviation = slope * rev + intercept
    n = len(revs)
    mean_x = sum(revs) / n
    mean_y = sum(deviations) / n

    numerator = sum((revs[i] - mean_x) * (deviations[i] - mean_y) for i in range(n))
    denominator = sum((revs[i] - mean_x) ** 2 for i in range(n))

    if denominator > 0:
        slope = numerator / denominator
    else:
        slope = 0.05

    # Non-negative degradation rate
    degradation_rate_mm_per_rev = max(0.01, round(slope, 4))
    current_max_dev = max(deviations)

    # RUL calculation: Revolutions remaining until reaching critical replacement threshold
    remaining_margin_mm = max(0.0, critical_threshold_mm - current_max_dev)
    estimated_revs_left = int(remaining_margin_mm / degradation_rate_mm_per_rev)

    # Convert revolutions to operating hours based on belt RPM
    # seconds per rev = 60 / RPM
    sec_per_rev = 60.0 / max(0.1, current_belt_rpm)
    estimated_hours_left = round((estimated_revs_left * sec_per_rev) / 3600.0, 1)

    # Confidence calculation based on variance and sample count
    confidence = min(0.94, 0.55 + (unique_revs * 0.08))

    # Formulate safety warning
    if estimated_hours_left <= 12.0:
        warning = (
            "CRITICAL: Vulcanized joint degradation rate indicates imminent failure "
            f"within ~{estimated_hours_left} operating hours. Immediate splice replacement required."
        )
    elif estimated_hours_left <= 72.0:
        warning = (
            f"ATTENTION: Accelerated joint wear detected ({degradation_rate_mm_per_rev:.3f} mm/rev). "
            f"Estimated life ~{estimated_hours_left} hrs. Schedule inspection during next shift outage."
        )
    else:
        warning = (
            f"NOMINAL: Joint wear trend is within expected baseline limits ({degradation_rate_mm_per_rev:.3f} mm/rev). "
            f"Estimated remaining useful life ~{estimated_hours_left} hrs."
        )

    return {
        "dataSufficient": True,
        "sampleCount": sample_count,
        "criticalThresholdMm": critical_threshold_mm,
        "currentMaxDeviationMm": round(current_max_dev, 2),
        "degradationRateMmPerRev": degradation_rate_mm_per_rev,
        "estimatedRevolutionsRemaining": estimated_revs_left,
        "estimatedHoursRemaining": estimated_hours_left,
        "confidenceScore": round(confidence, 2),
        "warningMessage": warning,
        "trends": [
            {
                "revolution": d.get("revolution", 0),
                "deviationMm": d.get("laser_deviation_mm") or d.get("laserDeviationMm") or 0.0,
                "timestamp": d.get("timestamp", 0)
            }
            for d in joint_defects
        ]
    }
