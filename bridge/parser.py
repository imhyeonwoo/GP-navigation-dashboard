import re
import time
from typing import Optional

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


def parse_line(line: str) -> Optional[dict]:
    match = LINE_PATTERN.search(line.strip())
    if match is None:
        return None

    values = {key: float(value) for key, value in match.groupdict().items() if key != "fix"}
    values["fix"] = int(match.group("fix"))
    values["timestamp"] = time.time()
    return values
