import math
import queue
import random
import threading
import time

import serial

from .parser import parse_line


def serial_reader(port: str, baud: int, data_queue: queue.Queue, stop_event: threading.Event) -> None:
    try:
        with serial.Serial(port, baud, timeout=0.5) as serial_port:
            while not stop_event.is_set():
                try:
                    raw = serial_port.readline()
                except serial.SerialException as exc:
                    data_queue.put({"error": f"Serial error: {exc}"})
                    return

                if not raw:
                    continue

                line = raw.decode("utf-8", errors="ignore").strip()
                if not line:
                    continue

                sample = parse_line(line)
                if sample is not None:
                    data_queue.put(sample)
    except serial.SerialException as exc:
        data_queue.put({"error": f"Cannot open port {port}: {exc}"})


def demo_reader(data_queue: queue.Queue, stop_event: threading.Event) -> None:
    t = 0.0
    lat_base = 37.5417
    lon_base = 127.0795
    align_required = 5000
    ref_lat = lat_base
    ref_lon = lon_base
    ref_h = 42.125

    while not stop_event.is_set():
        t += 0.1
        align_samples = min(int(t * 500.0), align_required)
        align_complete = 1 if align_samples >= align_required else 0
        bgx = 0.00012 + 0.00001 * math.sin(t * 0.3)
        bgy = -0.00008 + 0.00001 * math.cos(t * 0.25)
        bgz = 0.00031 + 0.00002 * math.sin(t * 0.2)
        ned_n = 8.0 * math.sin(t * 0.12)
        ned_e = 0.5 * t
        ned_d = -0.4 + 0.05 * math.sin(t * 0.09)
        vert_zd_est = -0.8 + 0.18 * math.sin(t * 0.22)
        vert_zd_baro = vert_zd_est + 0.05 * math.sin(t * 1.4)
        vert_vzd = 0.18 * 0.22 * math.cos(t * 0.22)
        vert_ad_raw = 0.05 * math.sin(t * 5.0) + 0.02 * math.sin(t * 11.0)
        vert_ad_lpf = 0.85 * vert_ad_raw + 0.15 * (0.05 * math.sin((t - 0.1) * 5.0) + 0.02 * math.sin((t - 0.1) * 11.0))

        telemetry_sample = {
            "timestamp": time.time(),
            "kind": "telemetry",
            "fix": 3,
            "lat": lat_base + 0.0001 * math.sin(t * 0.3) + random.uniform(-0.00001, 0.00001),
            "lon": lon_base + 0.0001 * t * 0.5 + random.uniform(-0.00001, 0.00001),
            "qw": 0.924 + 0.01 * math.sin(t * 0.1),
            "qx": 0.014 + 0.002 * math.sin(t * 0.2),
            "qy": 0.002 + 0.001 * math.cos(t * 0.3),
            "qz": 0.380 + 0.005 * math.cos(t * 0.15),
            "gx": 0.002 * math.sin(t),
            "gy": 0.001 * math.cos(t * 1.3),
            "gz": 0.0005 * math.sin(t * 0.7),
            "ax": 0.017 + 0.002 * math.sin(t * 2.0),
            "ay": 0.026 + 0.003 * math.cos(t * 1.7),
            "az": 1.004 + 0.005 * math.sin(t * 0.5),
            "pcn": 0.10 + 0.02 * abs(math.sin(t * 0.05)),
            "pce": 0.14 + 0.03 * abs(math.sin(t * 0.04)),
            "pcd": 0.68 + 0.05 * abs(math.cos(t * 0.03)),
            "vcn": 0.012 + 0.002 * abs(math.sin(t * 0.07)),
            "vce": 0.019 + 0.003 * abs(math.cos(t * 0.06)),
            "vcd": 0.016 + 0.001 * abs(math.sin(t * 0.08)),
        }
        data_queue.put(telemetry_sample)

        if abs(t - 0.1) < 1.0e-6:
            data_queue.put({
                "timestamp": time.time(),
                "kind": "ned_ref",
                "ref_lat": ref_lat,
                "ref_lon": ref_lon,
                "ref_h": ref_h,
                "ref_valid": 1,
            })

        data_queue.put({
            "timestamp": time.time(),
            "kind": "gps_ned",
            "ned_fix": 3,
            "ned_n": ned_n,
            "ned_e": ned_e,
            "ned_d": ned_d,
        })

        data_queue.put({
            "timestamp": time.time(),
            "kind": "align",
            "align_samples": align_samples,
            "align_required": align_required,
            "bgx": bgx,
            "bgy": bgy,
            "bgz": bgz,
            "align_complete": align_complete,
        })

        data_queue.put({
            "timestamp": time.time(),
            "kind": "vertical",
            "vert_zd_est": vert_zd_est,
            "vert_alt": -vert_zd_est,
            "vert_vzd": vert_vzd,
            "vert_ad_raw": vert_ad_raw,
            "vert_ad_lpf": vert_ad_lpf,
            "vert_zd_baro": vert_zd_baro,
        })

        time.sleep(0.1)
