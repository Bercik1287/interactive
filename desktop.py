import socket
import threading
import time
import urllib.error
import urllib.request
import os
from pathlib import Path

from PySide6.QtCore import QStandardPaths, QUrl
from PySide6.QtWidgets import QApplication, QFileDialog
from PySide6.QtWebEngineWidgets import QWebEngineView
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
    # Chromium sandbox fails when launched as root in some environments.
    if hasattr(os, "geteuid") and os.geteuid() == 0:
        os.environ.setdefault("QTWEBENGINE_DISABLE_SANDBOX", "1")

    host = "127.0.0.1"
    port = find_free_port()
    base_url = f"http://{host}:{port}"

    server = FlaskServerThread(host, port)
    server.start()
    wait_until_ready(base_url)

    def handle_download(request) -> None:
        suggested_name = request.downloadFileName() or "interactive-maps-export.zip"
        downloads_dir = QStandardPaths.writableLocation(QStandardPaths.StandardLocation.DownloadLocation)
        if not downloads_dir:
            downloads_dir = str(Path.home())
        default_target = str(Path(downloads_dir) / suggested_name)

        selected_path, _ = QFileDialog.getSaveFileName(
            None,
            "Zapisz plik eksportu",
            default_target,
            "ZIP (*.zip);;Wszystkie pliki (*)",
        )
        if not selected_path:
            request.cancel()
            return

        target = Path(selected_path)
        request.setDownloadDirectory(str(target.parent))
        request.setDownloadFileName(target.name)
        request.accept()

    try:
        qt_app = QApplication([])
        view = QWebEngineView()
        view.page().profile().downloadRequested.connect(handle_download)
        view.setWindowTitle("Interactive Maps")
        view.resize(1440, 900)
        view.setMinimumSize(1024, 700)
        view.load(QUrl(base_url))
        view.show()
        qt_app.exec()
    finally:
        server.shutdown()


if __name__ == "__main__":
    main()
