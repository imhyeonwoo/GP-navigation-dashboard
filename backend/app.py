import argparse
import queue
import threading
import time
from pathlib import Path

from flask import Flask, jsonify, render_template
from flask_socketio import SocketIO
import serial.tools.list_ports

from bridge import DataStore, demo_reader, serial_reader

BASE_DIR = Path(__file__).resolve().parent.parent
FRONTEND_DIR = BASE_DIR / "frontend"

app = Flask(
    __name__,
    template_folder=str(FRONTEND_DIR / "templates"),
    static_folder=str(FRONTEND_DIR / "static"),
    static_url_path="/static",
)
app.config["SECRET_KEY"] = "gnss_ins_secret"
socketio = SocketIO(app, cors_allowed_origins="*", async_mode="threading")

store = DataStore(300)
data_queue: queue.Queue = queue.Queue()
status = {"message": "Connecting", "port": "N/A", "baud": 115200}
stop_event = threading.Event()


@app.route("/")
def index():
    return render_template("index.html")


@app.route("/api/history")
def api_history():
    samples = store.snapshot()
    if samples:
        t0 = samples[0]["timestamp"]
        for sample in samples:
            sample["t"] = round(sample["timestamp"] - t0, 3)
    return jsonify({"samples": samples, "status": dict(status)})


@app.route("/api/ports")
def api_ports():
    ports = [port.device for port in serial.tools.list_ports.comports()]
    return jsonify({"ports": ports})


def broadcaster() -> None:
    while not stop_event.is_set():
        batch: list[dict] = []
        while True:
            try:
                item = data_queue.get_nowait()
            except queue.Empty:
                break

            if "error" in item:
                status["message"] = item["error"]
                socketio.emit("status", {"message": status["message"]})
                continue

            store.append(item)
            status["message"] = "Streaming"
            batch.append(item)

        if batch:
            samples = store.snapshot()
            t0 = samples[0]["timestamp"] if samples else batch[0]["timestamp"]
            payload = []
            for sample in batch:
                item = dict(sample)
                item["t"] = round(item["timestamp"] - t0, 3)
                payload.append(item)
            socketio.emit("data", {"samples": payload, "status": status["message"]})

        time.sleep(0.1)


def main() -> None:
    parser = argparse.ArgumentParser(description="GNSS/INS Web Visualizer")
    parser.add_argument("--port", default="DEMOMODE", help="Serial port such as COM7 or DEMOMODE")
    parser.add_argument("--baud", type=int, default=115200)
    parser.add_argument("--max-points", type=int, default=500)
    parser.add_argument("--host", default="127.0.0.1")
    parser.add_argument("--web-port", type=int, default=5000)
    args = parser.parse_args()

    store.max_points = args.max_points
    status["port"] = args.port
    status["baud"] = args.baud

    if args.port.upper() == "DEMOMODE":
        status["message"] = "Demo"
        reader = threading.Thread(target=demo_reader, args=(data_queue, stop_event), daemon=True)
    else:
        reader = threading.Thread(
            target=serial_reader,
            args=(args.port, args.baud, data_queue, stop_event),
            daemon=True,
        )
    reader.start()

    broadcaster_thread = threading.Thread(target=broadcaster, daemon=True)
    broadcaster_thread.start()

    print("\nGNSS / INS Web Visualizer")
    print(f"Open http://{args.host}:{args.web_port} in your browser\n")

    try:
        socketio.run(app, host=args.host, port=args.web_port, debug=False, allow_unsafe_werkzeug=True)
    finally:
        stop_event.set()


if __name__ == "__main__":
    main()
