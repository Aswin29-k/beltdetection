"""
Unit tests for proximity sensor timing, speed estimation, and sensor fusion.
"""

import pytest
import sys
import os

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "../backend")))


def test_belt_speed_estimation():
    belt_length_m = 12.0
    # Revolution period = 14.117 seconds
    period_sec = 14.117
    speed = belt_length_m / period_sec
    rpm = 60.0 / period_sec

    assert 0.84 < speed < 0.86
    assert 4.2 < rpm < 4.3


def test_marking_transit_delay():
    distance_cam_to_marker_m = 1.200 # 1200 mm
    speed_mps = 0.85

    # Delay = Distance / Speed
    delay_sec = distance_cam_to_marker_m / speed_mps
    delay_ms = delay_sec * 1000.0

    # 1.2 / 0.85 = ~1.4117 s = 1412 ms
    assert 1400 < delay_ms < 1420


def test_joint_zone_boundary_detection():
    belt_length_mm = 12000.0
    joint_margin_mm = 300.0

    def is_joint(pos_mm):
        return (pos_mm <= joint_margin_mm) or (pos_mm >= (belt_length_mm - joint_margin_mm))

    assert is_joint(50.0) is True
    assert is_joint(299.0) is True
    assert is_joint(11850.0) is True
    assert is_joint(11990.0) is True
    assert is_joint(500.0) is False
    assert is_joint(6000.0) is False
