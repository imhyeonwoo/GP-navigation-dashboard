import threading


class DataStore:
    def __init__(self, max_points: int) -> None:
        self.max_points = max_points
        self.samples: list[dict] = []
        self.lock = threading.Lock()

    def append(self, sample: dict) -> None:
        with self.lock:
            self.samples.append(sample)
            if len(self.samples) > self.max_points:
                self.samples = self.samples[-self.max_points :]

    def snapshot(self) -> list[dict]:
        with self.lock:
            return [dict(sample) for sample in self.samples]
