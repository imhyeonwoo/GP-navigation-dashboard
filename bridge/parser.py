import math
import re
import struct
import time
from typing import Optional

SYNC_0 = 0xA5
SYNC_1 = 0x5A
PROTOCOL_VERSION = 0x01
HEADER_SIZE = 12
FRAME_OVERHEAD = 14

MSG_SENSOR_SNAPSHOT = 0x01
MSG_ALIGNMENT = 0x02
MSG_NED_REFERENCE = 0x03
MSG_GPS_NED = 0x04
MSG_PROPAGATION = 0x05
MSG_INS_CHECK = 0x06
MSG_GPS_CORRECTION = 0x07

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
    r"a_ned=\[(?P<prop_an>-?\d+\.\d+),(?P<prop_ae>-?\d+\.\d+),(?P<prop_ad>-?\d+\.\d+)\]"
    r"(?:\s+v_ned=\[(?P<prop_vn>-?\d+\.\d+),(?P<prop_ve>-?\d+\.\d+),(?P<prop_vd>-?\d+\.\d+)\]\s+"
    r"p_ned=\[(?P<prop_pn>-?\d+\.\d+),(?P<prop_pe>-?\d+\.\d+),(?P<prop_pd>-?\d+\.\d+)\])?"
)

PROPAGATION_FIRST_PATTERN = re.compile(
    r"PROP\s+first\s+dt=(?P<prop_dt>-?\d+\.\d+)\s+"
    r"a_ned=\[(?P<prop_an>-?\d+\.\d+),(?P<prop_ae>-?\d+\.\d+),(?P<prop_ad>-?\d+\.\d+)\]"
)

INS_CHECK_PATTERN = re.compile(
    r"INSCHK\s+fb_b=\[(?P<ins_fb_x>-?\d+\.\d+),(?P<ins_fb_y>-?\d+\.\d+),(?P<ins_fb_z>-?\d+\.\d+)\]\s+"
    r"a_n=\[(?P<ins_an>-?\d+\.\d+),(?P<ins_ae>-?\d+\.\d+),(?P<ins_ad>-?\d+\.\d+)\]\s+"
    r"v_ned=\[(?P<ins_vn>-?\d+\.\d+),(?P<ins_ve>-?\d+\.\d+),(?P<ins_vd>-?\d+\.\d+)\]\s+"
    r"p_ned=\[(?P<ins_pn>-?\d+\.\d+),(?P<ins_pe>-?\d+\.\d+),(?P<ins_pd>-?\d+\.\d+)\]\s+"
    r"b_a=\[(?P<ins_bax>-?\d+\.\d+),(?P<ins_bay>-?\d+\.\d+),(?P<ins_baz>-?\d+\.\d+)\]\s+"
    r"Pdiag=\[(?P<ins_pdiag_pn>-?\d+\.\d+),(?P<ins_pdiag_pe>-?\d+\.\d+),(?P<ins_pdiag_pd>-?\d+\.\d+),(?P<ins_pdiag_vn>-?\d+\.\d+),(?P<ins_pdiag_ve>-?\d+\.\d+),(?P<ins_pdiag_vd>-?\d+\.\d+)\]"
)

GPS_CORRECTION_PATTERN = re.compile(
    r"GPSCOR\s+z=\[(?P<corr_z_pn>-?\d+\.\d+),(?P<corr_z_pe>-?\d+\.\d+),(?P<corr_z_pd>-?\d+\.\d+),(?P<corr_z_vn>-?\d+\.\d+),(?P<corr_z_ve>-?\d+\.\d+),(?P<corr_z_vd>-?\d+\.\d+)\]\s+"
    r"y=\[(?P<corr_y_pn>-?\d+\.\d+),(?P<corr_y_pe>-?\d+\.\d+),(?P<corr_y_pd>-?\d+\.\d+),(?P<corr_y_vn>-?\d+\.\d+),(?P<corr_y_ve>-?\d+\.\d+),(?P<corr_y_vd>-?\d+\.\d+)\]\s+"
    r"dx=\[(?P<corr_dx_pn>-?\d+\.\d+),(?P<corr_dx_pe>-?\d+\.\d+),(?P<corr_dx_pd>-?\d+\.\d+),(?P<corr_dx_vn>-?\d+\.\d+),(?P<corr_dx_ve>-?\d+\.\d+),(?P<corr_dx_vd>-?\d+\.\d+)\]\s+"
    r"x=\[(?P<corr_x_pn>-?\d+\.\d+),(?P<corr_x_pe>-?\d+\.\d+),(?P<corr_x_pd>-?\d+\.\d+),(?P<corr_x_vn>-?\d+\.\d+),(?P<corr_x_ve>-?\d+\.\d+),(?P<corr_x_vd>-?\d+\.\d+)\]"
)


def _with_timestamp(values: dict) -> dict:
    values["timestamp"] = time.time()
    return values


def _attach_meta(values: dict, sequence: int, tick_ms: int) -> dict:
    values["sequence"] = sequence
    values["tick_ms"] = tick_ms
    return _with_timestamp(values)


def _latlon_from_e7(lat_e7: int, lon_e7: int) -> tuple[float, float]:
    return lat_e7 * 1.0e-7, lon_e7 * 1.0e-7


def _add_sigma(values: dict) -> dict:
    values["ins_sig_pn"] = math.sqrt(max(values["ins_pdiag_pn"], 0.0))
    values["ins_sig_pe"] = math.sqrt(max(values["ins_pdiag_pe"], 0.0))
    values["ins_sig_pd"] = math.sqrt(max(values["ins_pdiag_pd"], 0.0))
    values["ins_sig_vn"] = math.sqrt(max(values["ins_pdiag_vn"], 0.0))
    values["ins_sig_ve"] = math.sqrt(max(values["ins_pdiag_ve"], 0.0))
    values["ins_sig_vd"] = math.sqrt(max(values["ins_pdiag_vd"], 0.0))
    return values


def crc16_ccitt(data: bytes) -> int:
    crc = 0xFFFF
    for byte in data:
        crc ^= byte << 8
        for _ in range(8):
            if crc & 0x8000:
                crc = ((crc << 1) ^ 0x1021) & 0xFFFF
            else:
                crc = (crc << 1) & 0xFFFF
    return crc


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
            "prop_ad": float(match.group("prop_ad")),
            "kind": "propagation",
        }
        return _with_timestamp(values)

    match = INS_CHECK_PATTERN.search(text)
    if match is not None:
        values = {key: float(value) for key, value in match.groupdict().items()}
        values["kind"] = "ins_check"
        return _with_timestamp(_add_sigma(values))

    match = GPS_CORRECTION_PATTERN.search(text)
    if match is not None:
        values = {key: float(value) for key, value in match.groupdict().items()}
        values["kind"] = "gps_correction"
        return _with_timestamp(values)

    return None


def parse_packet(frame: bytes) -> Optional[dict]:
    if len(frame) < FRAME_OVERHEAD or frame[0] != SYNC_0 or frame[1] != SYNC_1:
        return None

    version = frame[2]
    if version != PROTOCOL_VERSION:
        return None

    msg_id = frame[3]
    sequence = struct.unpack_from("<H", frame, 4)[0]
    tick_ms = struct.unpack_from("<I", frame, 6)[0]
    payload_length = struct.unpack_from("<H", frame, 10)[0]
    payload = frame[12 : 12 + payload_length]
    recv_crc = struct.unpack_from("<H", frame, 12 + payload_length)[0]

    if crc16_ccitt(frame[2 : 12 + payload_length]) != recv_crc:
        return None

    if msg_id == MSG_SENSOR_SNAPSHOT and payload_length == 73:
        fix = payload[0]
        lat_e7, lon_e7 = struct.unpack_from("<ii", payload, 1)
        (
            pcn,
            pce,
            pcd,
            vcn,
            vce,
            vcd,
            qw,
            qx,
            qy,
            qz,
            gx,
            gy,
            gz,
            ax,
            ay,
            az,
        ) = struct.unpack_from("<16f", payload, 9)
        lat, lon = _latlon_from_e7(lat_e7, lon_e7)
        return _attach_meta(
            {
                "kind": "telemetry",
                "fix": fix,
                "lat": lat,
                "lon": lon,
                "pcn": pcn,
                "pce": pce,
                "pcd": pcd,
                "vcn": vcn,
                "vce": vce,
                "vcd": vcd,
                "qw": qw,
                "qx": qx,
                "qy": qy,
                "qz": qz,
                "gx": gx,
                "gy": gy,
                "gz": gz,
                "ax": ax,
                "ay": ay,
                "az": az,
            },
            sequence,
            tick_ms,
        )

    if msg_id == MSG_ALIGNMENT and payload_length == 25:
        align_samples, align_required = struct.unpack_from("<II", payload, 0)
        bgx, bgy, bgz = struct.unpack_from("<fff", payload, 8)
        align_complete = payload[20]
        return _attach_meta(
            {
                "kind": "align",
                "align_samples": align_samples,
                "align_required": align_required,
                "bgx": bgx,
                "bgy": bgy,
                "bgz": bgz,
                "align_complete": align_complete,
            },
            sequence,
            tick_ms,
        )

    if msg_id == MSG_NED_REFERENCE and payload_length == 12:
        lat_e7, lon_e7, ref_h = struct.unpack_from("<iif", payload, 0)
        ref_lat, ref_lon = _latlon_from_e7(lat_e7, lon_e7)
        return _attach_meta(
            {
                "kind": "ned_ref",
                "ref_lat": ref_lat,
                "ref_lon": ref_lon,
                "ref_h": ref_h,
                "ref_valid": 1,
            },
            sequence,
            tick_ms,
        )

    if msg_id == MSG_GPS_NED and payload_length == 13:
        ned_fix = payload[0]
        ned_n, ned_e, ned_d = struct.unpack_from("<fff", payload, 1)
        return _attach_meta(
            {
                "kind": "gps_ned",
                "ned_fix": ned_fix,
                "ned_n": ned_n,
                "ned_e": ned_e,
                "ned_d": ned_d,
            },
            sequence,
            tick_ms,
        )

    if msg_id == MSG_PROPAGATION and payload_length == 56:
        (
            prop_dt,
            prop_rate_hz,
            prop_avg_dt,
            prop_min_dt,
            prop_max_dt,
            prop_an,
            prop_ae,
            prop_ad,
            prop_vn,
            prop_ve,
            prop_vd,
            prop_pn,
            prop_pe,
            prop_pd,
        ) = struct.unpack_from("<14f", payload, 0)
        return _attach_meta(
            {
                "kind": "propagation",
                "prop_dt": prop_dt,
                "prop_rate_hz": prop_rate_hz,
                "prop_avg_dt": prop_avg_dt,
                "prop_min_dt": prop_min_dt,
                "prop_max_dt": prop_max_dt,
                "prop_an": prop_an,
                "prop_ae": prop_ae,
                "prop_ad": prop_ad,
                "prop_vn": prop_vn,
                "prop_ve": prop_ve,
                "prop_vd": prop_vd,
                "prop_pn": prop_pn,
                "prop_pe": prop_pe,
                "prop_pd": prop_pd,
            },
            sequence,
            tick_ms,
        )

    if msg_id == MSG_INS_CHECK and payload_length == 84:
        (
            ins_fb_x,
            ins_fb_y,
            ins_fb_z,
            ins_an,
            ins_ae,
            ins_ad,
            ins_vn,
            ins_ve,
            ins_vd,
            ins_pn,
            ins_pe,
            ins_pd,
            ins_bax,
            ins_bay,
            ins_baz,
            ins_pdiag_pn,
            ins_pdiag_pe,
            ins_pdiag_pd,
            ins_pdiag_vn,
            ins_pdiag_ve,
            ins_pdiag_vd,
        ) = struct.unpack_from("<21f", payload, 0)
        values = {
            "kind": "ins_check",
            "ins_fb_x": ins_fb_x,
            "ins_fb_y": ins_fb_y,
            "ins_fb_z": ins_fb_z,
            "ins_an": ins_an,
            "ins_ae": ins_ae,
            "ins_ad": ins_ad,
            "ins_vn": ins_vn,
            "ins_ve": ins_ve,
            "ins_vd": ins_vd,
            "ins_pn": ins_pn,
            "ins_pe": ins_pe,
            "ins_pd": ins_pd,
            "ins_bax": ins_bax,
            "ins_bay": ins_bay,
            "ins_baz": ins_baz,
            "ins_pdiag_pn": ins_pdiag_pn,
            "ins_pdiag_pe": ins_pdiag_pe,
            "ins_pdiag_pd": ins_pdiag_pd,
            "ins_pdiag_vn": ins_pdiag_vn,
            "ins_pdiag_ve": ins_pdiag_ve,
            "ins_pdiag_vd": ins_pdiag_vd,
        }
        return _attach_meta(_add_sigma(values), sequence, tick_ms)

    if msg_id == MSG_GPS_CORRECTION and payload_length == 96:
        values = struct.unpack_from("<24f", payload, 0)
        return _attach_meta(
            {
                "kind": "gps_correction",
                "corr_z_pn": values[0],
                "corr_z_pe": values[1],
                "corr_z_pd": values[2],
                "corr_z_vn": values[3],
                "corr_z_ve": values[4],
                "corr_z_vd": values[5],
                "corr_y_pn": values[6],
                "corr_y_pe": values[7],
                "corr_y_pd": values[8],
                "corr_y_vn": values[9],
                "corr_y_ve": values[10],
                "corr_y_vd": values[11],
                "corr_dx_pn": values[12],
                "corr_dx_pe": values[13],
                "corr_dx_pd": values[14],
                "corr_dx_vn": values[15],
                "corr_dx_ve": values[16],
                "corr_dx_vd": values[17],
                "corr_x_pn": values[18],
                "corr_x_pe": values[19],
                "corr_x_pd": values[20],
                "corr_x_vn": values[21],
                "corr_x_ve": values[22],
                "corr_x_vd": values[23],
            },
            sequence,
            tick_ms,
        )

    return None


class TelemetryStreamParser:
    def __init__(self) -> None:
        self._buffer = bytearray()
        self._line_buffer = bytearray()

    def feed(self, chunk: bytes) -> list[dict]:
        samples: list[dict] = []
        if not chunk:
            return samples

        self._buffer.extend(chunk)

        while self._buffer:
            if self._buffer[0] == SYNC_0:
                if len(self._buffer) == 1:
                    break

                if self._buffer[1] == SYNC_1:
                    if len(self._buffer) < HEADER_SIZE:
                        break

                    payload_length = struct.unpack_from("<H", self._buffer, 10)[0]
                    frame_length = FRAME_OVERHEAD + payload_length
                    if len(self._buffer) < frame_length:
                        break

                    frame = bytes(self._buffer[:frame_length])
                    sample = parse_packet(frame)
                    if sample is not None:
                        samples.append(sample)
                        del self._buffer[:frame_length]
                        continue

                self._consume_text_byte(self._buffer.pop(0), samples)
                continue

            self._consume_text_byte(self._buffer.pop(0), samples)

        return samples

    def _consume_text_byte(self, value: int, samples: list[dict]) -> None:
        if value in (0x0A, 0x0D):
            if self._line_buffer:
                line = self._line_buffer.decode("utf-8", errors="ignore").strip()
                self._line_buffer.clear()
                sample = parse_line(line)
                if sample is not None:
                    samples.append(sample)
            return

        if 32 <= value <= 126 or value in (0x09,):
            self._line_buffer.append(value)
        else:
            self._line_buffer.clear()
