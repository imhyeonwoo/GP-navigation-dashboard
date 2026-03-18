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

    while not stop_event.is_set():
        t += 0.1
        sample = {
            "timestamp": time.time(),
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
        data_queue.put(sample)
        time.sleep(0.1)
