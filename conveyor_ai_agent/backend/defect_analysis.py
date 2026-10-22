"""
Defect analysis and geometric triangulation engine for BeltGuard AI.
Conforms to DIN 22102 and ISO 15236 conveyor belt standard tolerances.
"""

import math
from typing import Dict, Any, List, Optional, Tuple


class TriangulationModel:
    """
    Geometric Laser Triangulation Model.
    
    Geometry:
    - Optical axis perpendicular to conveyor belt plane (Z-axis).
    - Sheet-of-light laser projector angled at incidence angle theta (default 45 deg).
    - Camera focal length f, sensor pixel pitch p_pix.
    
    Surface height displacement:
    Delta_Z = Delta_Y_pix * scale_factor / sin(theta)
    """

    def __init__(self, theta_deg: float = 45.0, scale_factor_mm_per_px: float = 0.22):
        self.theta_deg = theta_deg
        self.theta_rad = math.radians(theta_deg)
        self.scale_factor_mm_per_px = scale_factor_mm_per_px

    def pixel_to_depth_mm(self, delta_y_pixels: float) -> float:
        """Calculate physical depth/height change from pixel displacement."""
        if delta_y_pixels <= 0:
            return 0.0
        # For small angles and flat belt baseline:
        return (delta_y_pixels * self.scale_factor_mm_per_px) / math.sin(self.theta_rad)

    def calibrate_scale(self, known_gauge_thickness_mm: float, measured_pixel_shift: float) -> float:
        """Calibrate mm per pixel using a certified reference gauge block."""
        if measured_pixel_shift <= 0:
            raise ValueError("Measured pixel shift must be positive")
        calibrated_scale = (known_gauge_thickness_mm * math.sin(self.theta_rad)) / measured_pixel_shift
        self.scale_factor_mm_per_px = calibrated_scale
        return calibrated_scale


def evaluate_defect_severity(
    deviation_mm: float,
    width_mm: float,
    is_joint_associated: bool,
    belt_cover_thickness_mm: float = 8.0
) -> Tuple[str, float]:
    """
    Classify defect severity against conveyor belt carcass exposure thresholds.
    Returns (severity_level, confidence).
    """
    # Cord exposure threshold is 75% of top rubber cover
    critical_threshold = belt_cover_thickness_mm * 0.75 # ~6.0mm

    if is_joint_associated:
        # Lower thresholds near vulcanized joint due to shear delamination hazard
        if deviation_mm >= 5.0 or (deviation_mm >= 3.5 and width_mm >= 15.0):
            return "CRITICAL", 0.96
        elif deviation_mm >= 3.0:
            return "HIGH", 0.92
        elif deviation_mm >= 1.5:
            return "MEDIUM", 0.88
        else:
            return "LOW", 0.82
    else:
        if deviation_mm >= critical_threshold:
            return "CRITICAL", 0.95
        elif deviation_mm >= 4.0:
            return "HIGH", 0.90
        elif deviation_mm >= 2.0:
            return "MEDIUM", 0.86
        else:
            return "LOW", 0.80


def cluster_defects_across_revolutions(
    defects: List[Dict[str, Any]],
    belt_length_mm: float = 12000.0,
    spatial_tolerance_mm: float = 150.0
) -> List[Dict[str, Any]]:
    """
    Group recurring defects across multiple belt revolutions to track growth rate.
    """
    clusters: List[Dict[str, Any]] = []

    for d in sorted(defects, key=lambda x: x.get("revolution", 0)):
        pos = d.get("distanceFromJointMm", 0.0)
        matched = False

        for c in clusters:
            ref_pos = c["referencePositionMm"]
            diff = abs(ref_pos - pos)
            if diff > (belt_length_mm / 2.0):
                diff = belt_length_mm - diff

            if diff <= spatial_tolerance_mm:
                c["history"].append(d)
                c["latestDeviationMm"] = d.get("laserDeviationMm", 0.0)
                c["lastSeenRev"] = d.get("revolution", 0)
                matched = True
                break

        if not matched:
            clusters.append({
                "clusterId": f"CLUST-{len(clusters)+1:03d}",
                "referencePositionMm": pos,
                "firstSeenRev": d.get("revolution", 0),
                "lastSeenRev": d.get("revolution", 0),
                "isJointAssociated": d.get("isJointAssociated", False),
                "initialDeviationMm": d.get("laserDeviationMm", 0.0),
                "latestDeviationMm": d.get("laserDeviationMm", 0.0),
                "history": [d]
            })

    # Compute growth rates
    for c in clusters:
        rev_span = c["lastSeenRev"] - c["firstSeenRev"]
        if rev_span > 0:
            growth = (c["latestDeviationMm"] - c["initialDeviationMm"]) / float(rev_span)
            c["growthRateMmPerRev"] = round(growth, 4)
        else:
            c["growthRateMmPerRev"] = 0.0

    return clusters
