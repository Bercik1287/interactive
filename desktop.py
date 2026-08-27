import socket
import threading
import time
import urllib.error
import urllib.request

import webview
from werkzeug.serving import make_server

from app import app


class FlaskServerThread(threading.Thread):
    def __init__(self, host: str, port: int):
        super().__init__(daemon=True)
        self.host = host
        self.port = port
        self._server = make_server(host, port, app)

    def run(self) -> None:
        self._server.serve_forever()

    def shutdown(self) -> None:
        self._server.shutdown()


def find_free_port() -> int:
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as sock:
        sock.bind(("127.0.0.1", 0))
        return int(sock.getsockname()[1])


def wait_until_ready(base_url: str, timeout_seconds: float = 8.0) -> None:
    deadline = time.time() + timeout_seconds
    while time.time() < deadline:
        try:
            with urllib.request.urlopen(f"{base_url}/api/map-data", timeout=1.0) as response:
                if response.status == 200:
                    return
        except (urllib.error.URLError, TimeoutError):
            time.sleep(0.1)
    raise RuntimeError("Desktop server failed to start in time.")


def main() -> None:
    host = "127.0.0.1"
    port = find_free_port()
    base_url = f"http://{host}:{port}"

    server = FlaskServerThread(host, port)
    server.start()
    wait_until_ready(base_url)

    webview.create_window(
        "Interactive Maps",
        base_url,
        width=1440,
        height=900,
        min_size=(1024, 700),
    )
    try:
        webview.start()
    finally:
        server.shutdown()


if __name__ == "__main__":
    main()
