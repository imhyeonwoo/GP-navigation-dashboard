import argparse
import queue
from typing import Optional
import re
import threading
import time

import matplotlib.pyplot as plt
from matplotlib.animation import FuncAnimation
import serial


LINE_PATTERN = re.compile(
    r"GPS fix=(?P<fix>\d+)\s+"
    r"lat=(?P<lat>-?\d+\.\d+)\s+"
    r"lon=(?P<lon>-?\d+\.\d+)\s+"
    r"Pcov_xyz\(N,E,D\)=\[(?P<pcn>-?\d+\.\d+),(?P<pce>-?\d+\.\d+),(?P<pcd>-?\d+\.\d+)\]\s+"
    r"Vcov_xyz\(N,E,D\)=\[(?P<vcn>-?\d+\.\d+),(?P<vce>-?\d+\.\d+),(?P<vcd>-?\d+\.\d+)\]\s+\|\s+"
    r"IMU q=\((?P<qw>-?\d+\.\d+),(?P<qx>-?\d+\.\d+),(?P<qy>-?\d+\.\d+),(?P<qz>-?\d+\.\d+)\)\s+"
    r"G=\((?P<gx>-?\d+\.\d+),(?P<gy>-?\d+\.\d+),(?P<gz>-?\d+\.\d+)\)\s+"
    r"A=\((?P<ax>-?\d+\.\d+),(?P<ay>-?\d+\.\d+),(?P<az>-?\d+\.\d+)\)"
)


class DataStore:
    def __init__(self, max_points: int) -> None:
        self.max_points = max_points
        self.samples = []
        self.lock = threading.Lock()

    def append(self, sample: dict) -> None:
        with self.lock:
            self.samples.append(sample)
            if len(self.samples) > self.max_points:
                self.samples = self.samples[-self.max_points :]

    def snapshot(self) -> list[dict]:
        with self.lock:
            return list(self.samples)


def parse_line(line: str) -> Optional[dict]:
    match = LINE_PATTERN.search(line.strip())
    if match is None:
        return None

    values = {key: float(value) for key, value in match.groupdict().items() if key != "fix"}
    values["fix"] = int(match.group("fix"))
    values["timestamp"] = time.time()
    return values


def serial_reader(port: str, baud: int, data_queue: queue.Queue, stop_event: threading.Event) -> None:
    with serial.Serial(port, baud, timeout=0.5) as ser:
        while not stop_event.is_set():
            try:
                raw = ser.readline()
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


def update_store_from_queue(store: DataStore, data_queue: queue.Queue, status: dict) -> None:
    while True:
        try:
            item = data_queue.get_nowait()
        except queue.Empty:
            return

        if "error" in item:
            status["message"] = item["error"]
            continue

        store.append(item)
        status["message"] = "Streaming"


def animate(_frame, store: DataStore, data_queue: queue.Queue, axes, lines, text_box, status: dict) -> None:
    update_store_from_queue(store, data_queue, status)
    samples = store.snapshot()
    if not samples:
        text_box.set_text("Waiting for data...")
        return

    t0 = samples[0]["timestamp"]
    times = [sample["timestamp"] - t0 for sample in samples]
    lats = [sample["lat"] for sample in samples]
    lons = [sample["lon"] for sample in samples]

    lines["track"].set_data(lons, lats)
    axes["track"].relim()
    axes["track"].autoscale_view()

    for idx, key in enumerate(("qw", "qx", "qy", "qz")):
        lines[key].set_data(times, [sample[key] for sample in samples])
    axes["quat"].relim()
    axes["quat"].autoscale_view()

    for key in ("gx", "gy", "gz"):
        lines[key].set_data(times, [sample[key] for sample in samples])
    axes["gyro"].relim()
    axes["gyro"].autoscale_view()

    for key in ("ax", "ay", "az"):
        lines[key].set_data(times, [sample[key] for sample in samples])
    axes["accel"].relim()
    axes["accel"].autoscale_view()

    for key in ("pcn", "pce", "pcd"):
        lines[key].set_data(times, [sample[key] for sample in samples])
    axes["pcov"].relim()
    axes["pcov"].autoscale_view()

    for key in ("vcn", "vce", "vcd"):
        lines[key].set_data(times, [sample[key] for sample in samples])
    axes["vcov"].relim()
    axes["vcov"].autoscale_view()

    latest = samples[-1]
    text_box.set_text(
        "\n".join(
            [
                f"Status: {status['message']}",
                f"Fix: {latest['fix']}",
                f"Lat/Lon: {latest['lat']:.7f}, {latest['lon']:.7f}",
                f"q: ({latest['qw']:.3f}, {latest['qx']:.3f}, {latest['qy']:.3f}, {latest['qz']:.3f})",
                f"G: ({latest['gx']:.3f}, {latest['gy']:.3f}, {latest['gz']:.3f})",
                f"A: ({latest['ax']:.3f}, {latest['ay']:.3f}, {latest['az']:.3f})",
                f"Pcov: ({latest['pcn']:.3f}, {latest['pce']:.3f}, {latest['pcd']:.3f})",
                f"Vcov: ({latest['vcn']:.3f}, {latest['vce']:.3f}, {latest['vcd']:.3f})",
            ]
        )
    )


def build_figure():
    fig, ax = plt.subplots(3, 2, figsize=(14, 10))
    axes = {
        "track": ax[0, 0],
        "quat": ax[0, 1],
        "gyro": ax[1, 0],
        "accel": ax[1, 1],
        "pcov": ax[2, 0],
        "vcov": ax[2, 1],
    }

    axes["track"].set_title("GPS Track")
    axes["track"].set_xlabel("Longitude")
    axes["track"].set_ylabel("Latitude")
    axes["track"].grid(True)

    axes["quat"].set_title("Quaternion")
    axes["quat"].set_xlabel("Time [s]")
    axes["quat"].grid(True)

    axes["gyro"].set_title("Gyro")
    axes["gyro"].set_xlabel("Time [s]")
    axes["gyro"].grid(True)

    axes["accel"].set_title("Accel")
    axes["accel"].set_xlabel("Time [s]")
    axes["accel"].grid(True)

    axes["pcov"].set_title("Position Covariance")
    axes["pcov"].set_xlabel("Time [s]")
    axes["pcov"].grid(True)

    axes["vcov"].set_title("Velocity Covariance")
    axes["vcov"].set_xlabel("Time [s]")
    axes["vcov"].grid(True)

    lines = {
        "track": axes["track"].plot([], [], color="tab:blue", linewidth=1.5)[0],
        "qw": axes["quat"].plot([], [], label="w")[0],
        "qx": axes["quat"].plot([], [], label="x")[0],
        "qy": axes["quat"].plot([], [], label="y")[0],
        "qz": axes["quat"].plot([], [], label="z")[0],
        "gx": axes["gyro"].plot([], [], label="gx")[0],
        "gy": axes["gyro"].plot([], [], label="gy")[0],
        "gz": axes["gyro"].plot([], [], label="gz")[0],
        "ax": axes["accel"].plot([], [], label="ax")[0],
        "ay": axes["accel"].plot([], [], label="ay")[0],
        "az": axes["accel"].plot([], [], label="az")[0],
        "pcn": axes["pcov"].plot([], [], label="N")[0],
        "pce": axes["pcov"].plot([], [], label="E")[0],
        "pcd": axes["pcov"].plot([], [], label="D")[0],
        "vcn": axes["vcov"].plot([], [], label="N")[0],
        "vce": axes["vcov"].plot([], [], label="E")[0],
        "vcd": axes["vcov"].plot([], [], label="D")[0],
    }

    axes["quat"].legend(loc="upper right")
    axes["gyro"].legend(loc="upper right")
    axes["accel"].legend(loc="upper right")
    axes["pcov"].legend(loc="upper right")
    axes["vcov"].legend(loc="upper right")

    text_box = fig.text(0.01, 0.01, "Waiting for data...", family="monospace", fontsize=10, va="bottom")
    fig.tight_layout(rect=(0, 0.08, 1, 1))
    return fig, axes, lines, text_box


def main() -> None:
    parser = argparse.ArgumentParser(description="Realtime GNSS/IMU serial visualizer")
    parser.add_argument("--port", required=True, help="Serial port, for example COM7")
    parser.add_argument("--baud", type=int, default=115200, help="Serial baud rate")
    parser.add_argument("--max-points", type=int, default=300, help="Maximum points kept in the rolling window")
    args = parser.parse_args()

    store = DataStore(args.max_points)
    data_queue: queue.Queue = queue.Queue()
    stop_event = threading.Event()
    status = {"message": "Connecting"}

    reader = threading.Thread(target=serial_reader, args=(args.port, args.baud, data_queue, stop_event), daemon=True)
    reader.start()

    fig, axes, lines, text_box = build_figure()
    animation = FuncAnimation(fig, animate, interval=100, cache_frame_data=False, fargs=(store, data_queue, axes, lines, text_box, status))

    try:
        plt.show()
    finally:
        stop_event.set()
        reader.join(timeout=1.0)
        del animation


if __name__ == "__main__":
    main()


