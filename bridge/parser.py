import re
import time
from typing import Optional

TELEMETRY_PATTERN = re.compile(
    r"GPS fix=(?P<fix>\d+)\s+"
    r"lat=(?P<lat>-?\d+\.\d+)\s+"
    r"lon=(?P<lon>-?\d+\.\d+)\s+"
    r"Pcov_xyz\(N,E,D\)=\[(?P<pcn>-?\d+\.\d+),(?P<pce>-?\d+\.\d+),(?P<pcd>-?\d+\.\d+)\]\s+"
    r"Vcov_xyz\(N,E,D\)=\[(?P<vcn>-?\d+\.\d+),(?P<vce>-?\d+\.\d+),(?P<vcd>-?\d+\.\d+)\]\s+\|\s+"
    r"IMU q=\((?P<qw>-?\d+\.\d+),(?P<qx>-?\d+\.\d+),(?P<qy>-?\d+\.\d+),(?P<qz>-?\d+\.\d+)\)\s+"
    r"G=\((?P<gx>-?\d+\.\d+),(?P<gy>-?\d+\.\d+),(?P<gz>-?\d+\.\d+)\)\s+"
    r"A=\((?P<ax>-?\d+\.\d+),(?P<ay>-?\d+\.\d+),(?P<az>-?\d+\.\d+)\)"
)

ALIGN_PROGRESS_PATTERN = re.compile(
    r"ALIGN\s+samples=(?P<align_samples>\d+)/(?P<align_required>\d+)\s+"
    r"gyro_bias_b=\[(?P<bgx>-?\d+\.\d+),(?P<bgy>-?\d+\.\d+),(?P<bgz>-?\d+\.\d+)\]"
)

ALIGN_DONE_PATTERN = re.compile(
    r"ALIGN\s+done\s+gyro_bias_b=\[(?P<bgx>-?\d+\.\d+),(?P<bgy>-?\d+\.\d+),(?P<bgz>-?\d+\.\d+)\]"
)

NED_REF_PATTERN = re.compile(
    r"NED\s+ref\s+set\s+lat=(?P<ref_lat>-?\d+\.\d+)\s+"
    r"lon=(?P<ref_lon>-?\d+\.\d+)\s+h=(?P<ref_h>-?\d+\.\d+)"
)

GPS_NED_PATTERN = re.compile(
    r"GPS_NED\s+fix=(?P<ned_fix>\d+)\s+"
    r"ned=\[(?P<ned_n>-?\d+\.\d+),(?P<ned_e>-?\d+\.\d+),(?P<ned_d>-?\d+\.\d+)\]"
)


def _with_timestamp(values: dict) -> dict:
    values["timestamp"] = time.time()
    return values


def parse_line(line: str) -> Optional[dict]:
    text = line.strip()
    if not text:
        return None

    match = TELEMETRY_PATTERN.search(text)
    if match is not None:
        values = {key: float(value) for key, value in match.groupdict().items() if key != "fix"}
        values["fix"] = int(match.group("fix"))
        values["kind"] = "telemetry"
        return _with_timestamp(values)

    match = ALIGN_PROGRESS_PATTERN.search(text)
    if match is not None:
        values = {
            "align_samples": int(match.group("align_samples")),
            "align_required": int(match.group("align_required")),
            "bgx": float(match.group("bgx")),
            "bgy": float(match.group("bgy")),
            "bgz": float(match.group("bgz")),
            "align_complete": 0,
            "kind": "align",
        }
        return _with_timestamp(values)

    match = ALIGN_DONE_PATTERN.search(text)
    if match is not None:
        values = {
            "bgx": float(match.group("bgx")),
            "bgy": float(match.group("bgy")),
            "bgz": float(match.group("bgz")),
            "align_complete": 1,
            "kind": "align",
        }
        return _with_timestamp(values)

    match = NED_REF_PATTERN.search(text)
    if match is not None:
        values = {
            "ref_lat": float(match.group("ref_lat")),
            "ref_lon": float(match.group("ref_lon")),
            "ref_h": float(match.group("ref_h")),
            "ref_valid": 1,
            "kind": "ned_ref",
        }
        return _with_timestamp(values)

    match = GPS_NED_PATTERN.search(text)
    if match is not None:
        values = {
            "ned_fix": int(match.group("ned_fix")),
            "ned_n": float(match.group("ned_n")),
            "ned_e": float(match.group("ned_e")),
            "ned_d": float(match.group("ned_d")),
            "kind": "gps_ned",
        }
        return _with_timestamp(values)

    return None
