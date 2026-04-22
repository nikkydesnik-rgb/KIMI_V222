#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Локальный сервер для Исполнительной Документации
Запуск: python server.py
"""

import http.server
import socketserver
import os
import webbrowser
import threading

PORT = 3456
DIST_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "dist")

MIME_TYPES = {
    ".html": "text/html",
    ".js": "application/javascript",
    ".css": "text/css",
    ".json": "application/json",
    ".png": "image/png",
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".gif": "image/gif",
    ".svg": "image/svg+xml",
    ".ico": "image/x-icon",
    ".woff": "font/woff",
    ".woff2": "font/woff2",
    ".ttf": "font/ttf",
    ".eot": "application/vnd.ms-fontobject",
    ".pdf": "application/pdf",
    ".docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    ".zip": "application/zip",
}


class Handler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=DIST_DIR, **kwargs)

    def end_headers(self):
        self.send_header("Access-Control-Allow-Origin", "*")
        super().end_headers()

    def guess_type(self, path):
        ext = os.path.splitext(path)[1].lower()
        return MIME_TYPES.get(ext, super().guess_type(path))

    def do_GET(self):
        # SPA routing: serve index.html for non-file paths
        file_path = os.path.join(DIST_DIR, self.path.lstrip("/"))
        if self.path != "/" and not os.path.isfile(file_path):
            self.path = "/"
        super().do_GET()


def open_browser():
    url = f"http://localhost:{PORT}"
    threading.Timer(1.5, lambda: webbrowser.open(url)).start()


def main():
    if not os.path.isdir(DIST_DIR):
        print(f"\nОШИБКА: Папка {DIST_DIR} не найдена!")
        print("Сначала соберите проект: npm run build")
        return

    with socketserver.TCPServer(("0.0.0.0", PORT), Handler) as httpd:
        print("\n========================================")
        print("  ИСПОЛНИТЕЛЬНАЯ ДОКУМЕНТАЦИЯ")
        print("========================================")
        print(f"\n  Сервер запущен!")
        print(f"\n  Откройте в браузере:")
        print(f"  http://localhost:{PORT}")
        print(f"\n  Для остановки нажмите Ctrl+C")
        print("========================================\n")

        open_browser()

        try:
            httpd.serve_forever()
        except KeyboardInterrupt:
            print("\n\nСервер остановлен.")


if __name__ == "__main__":
    main()
