"""Preview only the public tour files on localhost."""

from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
import sys


ROOT = Path(__file__).resolve().parents[1]


class Preview(SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(ROOT), **kwargs)

    def send_head(self):
        path = Path(self.translate_path(self.path)).resolve()
        if path == ROOT:
            self.path = "/index.html"
        elif not path.is_relative_to(ROOT) or not path.is_file():
            return self.send_error(404)
        elif path.name != "index.html" or path.parent != ROOT:
            parts = path.relative_to(ROOT).parts
            if parts[0] not in {"assets", "css", "js"} or any(p.startswith(".") for p in parts):
                return self.send_error(404)
        return super().send_head()

    def end_headers(self):
        self.send_header("Cache-Control", "no-cache")
        super().end_headers()


if __name__ == "__main__":
    port = int(sys.argv[1]) if len(sys.argv) > 1 else 4173
    ThreadingHTTPServer(("127.0.0.1", port), Preview).serve_forever()
