"""
Unit tests for laser triangulation mathematics, defect severity evaluation, and spatial clustering.
"""

import pytest
import math
import sys
import os

# Add backend directory to path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "../backend")))

from defect_analysis import TriangulationModel, evaluate_defect_severity, cluster_defects_across_revolutions


def test_triangulation_conversion():
    model = TriangulationModel(theta_deg=45.0, scale_factor_mm_per_px=0.22)
    # Expected depth = (20 px * 0.22) / sin(45 deg) = 4.4 / 0.7071 = ~6.22 mm
    depth = model.pixel_to_depth_mm(20.0)
    assert 6.20 < depth < 6.25


def test_triangulation_calibration():
    model = TriangulationModel(theta_deg=45.0, scale_factor_mm_per_px=0.20)
    # 5.0mm gauge block produced a 25 px shift
    new_scale = model.calibrate_scale(known_gauge_thickness_mm=5.0, measured_pixel_shift=25.0)
    # (5.0 * sin(45)) / 25.0 = 3.5355 / 25.0 = ~0.1414
    assert 0.140 < new_scale < 0.143


def test_evaluate_defect_severity_joint_vs_body():
    # 5.5mm defect on belt body (should be HIGH because critical carcass is 6.0mm)
    sev_body, conf_body = evaluate_defect_severity(5.5, 12.0, is_joint_associated=False)
    assert sev_body == "HIGH"

    # Same 5.5mm defect on vulcanized joint (critical threshold lowered to 5.0mm)
    sev_joint, conf_joint = evaluate_defect_severity(5.5, 12.0, is_joint_associated=True)
    assert sev_joint == "CRITICAL"
    assert conf_joint >= 0.95


def test_defect_clustering_and_growth_rate():
    defects = [
        {"id": "D1", "revolution": 10, "distanceFromJointMm": 165.0, "laserDeviationMm": 4.0, "isJointAssociated": True},
        {"id": "D2", "revolution": 12, "distanceFromJointMm": 170.0, "laserDeviationMm": 4.8, "isJointAssociated": True},
        {"id": "D3", "revolution": 14, "distanceFromJointMm": 168.0, "laserDeviationMm": 5.6, "isJointAssociated": True},
        {"id": "D4", "revolution": 11, "distanceFromJointMm": 5000.0, "laserDeviationMm": 2.1, "isJointAssociated": False}
    ]

    clusters = cluster_defects_across_revolutions(defects, belt_length_mm=12000.0, spatial_tolerance_mm=100.0)
    assert len(clusters) == 2 # Joint cluster + body cluster

    joint_cluster = next(c for c in clusters if c["isJointAssociated"])
    assert len(joint_cluster["history"]) == 3
    # Growth = (5.6 - 4.0) / (14 - 10) = 1.6 / 4 = 0.40 mm/rev
    assert abs(joint_cluster["growthRateMmPerRev"] - 0.40) < 0.01
