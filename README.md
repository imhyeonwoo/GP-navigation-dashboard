# GNSS INS Visualizer

Realtime GNSS/INS web visualizer with a PlotJuggler-style layout.

## Project Structure

```text
backend/
  app.py              Flask + Socket.IO server
bridge/
  parser.py           Serial line parser
  reader.py           Serial/demo data bridge
  store.py            Rolling sample store
frontend/
  templates/
    index.html        Web UI shell
  static/
    app.js            Plotting logic
    style.css         Dashboard styling
server.py             Root entrypoint
viewer.py             Legacy matplotlib viewer
```

## Features

- Left-side signal browser for enabling or disabling channels
- Shared rolling time axis for synchronized plots
- Separate plots for quaternion, gyro, accel, position covariance, and velocity covariance
- GPS track panel and latest sample summary
- Demo mode for testing without hardware

## Setup

```powershell
cd C:\STM32_WS\gnss_ins_visualizer
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
```

## Run

### Demo mode

```powershell
.\.venv\Scripts\Activate.ps1
python server.py --port DEMOMODE
```

### Real serial port

```powershell
.\.venv\Scripts\Activate.ps1
python server.py --port COM5 --baud 115200
```

Open `http://127.0.0.1:5000` in your browser.

## Options

| Flag           | Default     | Description                             |
| -------------- | ----------- | --------------------------------------- |
| `--port`       | `DEMOMODE`  | Serial port or `DEMOMODE`               |
| `--baud`       | `115200`    | Serial baud rate                        |
| `--max-points` | `500`       | Rolling buffer size kept by the backend |
| `--host`       | `127.0.0.1` | Bind address                            |
| `--web-port`   | `5000`      | HTTP port                               |

## Expected Input Format

```text
GPS fix=3 lat=37.5417762 lon=127.0796099 Pcov_xyz(N,E,D)=[0.157,0.296,0.911] Vcov_xyz(N,E,D)=[0.012,0.022,0.013] | IMU q=(0.925,0.014,0.002,0.380) G=(0.000,0.000,0.000) A=(0.017,0.026,1.004)
```
---

### Execution Example in Localhost

![example](docs/example(temp).png)
