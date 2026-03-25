import math
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

PROPAGATION_PATTERN = re.compile(
    r"PROP\s+dt=(?P<prop_dt>-?\d+\.\d+)\s+"
    r"(?:rate=(?P<prop_rate_hz>-?\d+\.\d+)Hz\s+"
    r"avg=(?P<prop_avg_dt>-?\d+\.\d+)\s+"
    r"min=(?P<prop_min_dt>-?\d+\.\d+)\s+"
    r"max=(?P<prop_max_dt>-?\d+\.\d+)\s+)?"
    r"a_ne=\[(?P<prop_an>-?\d+\.\d+),(?P<prop_ae>-?\d+\.\d+)\]"
    r"(?:\s+v_ne=\[(?P<prop_vn>-?\d+\.\d+),(?P<prop_ve>-?\d+\.\d+)\]\s+"
    r"p_ne=\[(?P<prop_pn>-?\d+\.\d+),(?P<prop_pe>-?\d+\.\d+)\])?"
)

PROPAGATION_FIRST_PATTERN = re.compile(
    r"PROP\s+first\s+dt=(?P<prop_dt>-?\d+\.\d+)\s+"
    r"a_ne=\[(?P<prop_an>-?\d+\.\d+),(?P<prop_ae>-?\d+\.\d+)\]"
)

INS_CHECK_PATTERN = re.compile(
    r"INSCHK\s+fb_b=\[(?P<ins_fb_x>-?\d+\.\d+),(?P<ins_fb_y>-?\d+\.\d+),(?P<ins_fb_z>-?\d+\.\d+)\]\s+"
    r"a_n=\[(?P<ins_an>-?\d+\.\d+),(?P<ins_ae>-?\d+\.\d+),(?P<ins_ad>-?\d+\.\d+)\]\s+"
    r"v_ne=\[(?P<ins_vn>-?\d+\.\d+),(?P<ins_ve>-?\d+\.\d+)\]\s+"
    r"p_ne=\[(?P<ins_pn>-?\d+\.\d+),(?P<ins_pe>-?\d+\.\d+)\]\s+"
    r"b_a=\[(?P<ins_bax>-?\d+\.\d+),(?P<ins_bay>-?\d+\.\d+)\]\s+"
    r"Pdiag=\[(?P<ins_pdiag_pn>-?\d+\.\d+),(?P<ins_pdiag_pe>-?\d+\.\d+),(?P<ins_pdiag_vn>-?\d+\.\d+),(?P<ins_pdiag_ve>-?\d+\.\d+)\]"
)

GPS_CORRECTION_PATTERN = re.compile(
    r"GPSCOR\s+z=\[(?P<corr_z_pn>-?\d+\.\d+),(?P<corr_z_pe>-?\d+\.\d+),(?P<corr_z_vn>-?\d+\.\d+),(?P<corr_z_ve>-?\d+\.\d+)\]\s+"
    r"y=\[(?P<corr_y_pn>-?\d+\.\d+),(?P<corr_y_pe>-?\d+\.\d+),(?P<corr_y_vn>-?\d+\.\d+),(?P<corr_y_ve>-?\d+\.\d+)\]\s+"
    r"dx=\[(?P<corr_dx_pn>-?\d+\.\d+),(?P<corr_dx_pe>-?\d+\.\d+),(?P<corr_dx_vn>-?\d+\.\d+),(?P<corr_dx_ve>-?\d+\.\d+)\]\s+"
    r"x=\[(?P<corr_x_pn>-?\d+\.\d+),(?P<corr_x_pe>-?\d+\.\d+),(?P<corr_x_vn>-?\d+\.\d+),(?P<corr_x_ve>-?\d+\.\d+)\]"
)

VERTICAL_PATTERN = re.compile(
    r"VERT\s+z_d_est=(?P<vert_zd_est>-?\d+\.\d+)\s+"
    r"alt=(?P<vert_alt>-?\d+\.\d+)\s+"
    r"vz_d=(?P<vert_vzd>-?\d+\.\d+)\s+"
    r"a_d_raw=(?P<vert_ad_raw>-?\d+\.\d+)\s+"
    r"a_d_lpf=(?P<vert_ad_lpf>-?\d+\.\d+)\s+"
    r"z_d_baro=(?P<vert_zd_baro>-?\d+\.\d+)"
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

    match = PROPAGATION_PATTERN.search(text)
    if match is not None:
        values = {"kind": "propagation"}
        for key, value in match.groupdict().items():
            if value is not None:
                values[key] = float(value)
        return _with_timestamp(values)

    match = PROPAGATION_FIRST_PATTERN.search(text)
    if match is not None:
        values = {
            "prop_dt": float(match.group("prop_dt")),
            "prop_an": float(match.group("prop_an")),
            "prop_ae": float(match.group("prop_ae")),
            "kind": "propagation",
        }
        return _with_timestamp(values)

    match = INS_CHECK_PATTERN.search(text)
    if match is not None:
        values = {key: float(value) for key, value in match.groupdict().items()}
        values["ins_sig_pn"] = math.sqrt(max(values["ins_pdiag_pn"], 0.0))
        values["ins_sig_pe"] = math.sqrt(max(values["ins_pdiag_pe"], 0.0))
        values["ins_sig_vn"] = math.sqrt(max(values["ins_pdiag_vn"], 0.0))
        values["ins_sig_ve"] = math.sqrt(max(values["ins_pdiag_ve"], 0.0))
        values["kind"] = "ins_check"
        return _with_timestamp(values)

    match = GPS_CORRECTION_PATTERN.search(text)
    if match is not None:
        values = {key: float(value) for key, value in match.groupdict().items()}
        values["kind"] = "gps_correction"
        return _with_timestamp(values)

    match = VERTICAL_PATTERN.search(text)
    if match is not None:
        values = {key: float(value) for key, value in match.groupdict().items()}
        values["kind"] = "vertical"
        return _with_timestamp(values)

    return None
