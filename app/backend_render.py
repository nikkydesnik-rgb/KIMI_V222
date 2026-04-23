#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Backend DOCX renderer (Python/docxtpl) for stable template filling.
Run: python backend_render.py
"""

import base64
import io
import os
from flask import Flask, jsonify, request, send_from_directory
from docxtpl import DocxTemplate

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DIST_DIR = os.path.join(BASE_DIR, "dist")

app = Flask(__name__, static_folder=DIST_DIR, static_url_path="")


@app.route("/api/health", methods=["GET"])
def health():
    return jsonify({"ok": True})


@app.route("/api/render-docx", methods=["POST"])
def render_docx():
    try:
        payload = request.get_json(silent=True) or {}
        template_base64 = payload.get("templateBase64", "")
        data = payload.get("data", {}) or {}

        if not template_base64:
            return jsonify({"success": False, "error": "templateBase64 is required"}), 400

        template_bytes = base64.b64decode(template_base64)
        tpl = DocxTemplate(io.BytesIO(template_bytes))
        tpl.render({k: "" if v is None else str(v) for k, v in data.items()})

        out = io.BytesIO()
        tpl.save(out)
        out.seek(0)

        return jsonify(
            {
                "success": True,
                "docxBase64": base64.b64encode(out.getvalue()).decode("utf-8"),
            }
        )
    except Exception as exc:
        return jsonify({"success": False, "error": str(exc)}), 500


@app.route("/", defaults={"path": ""})
@app.route("/<path:path>")
def serve_spa(path: str):
    # Keep API routes untouched
    if path.startswith("api/"):
        return jsonify({"success": False, "error": "Not found"}), 404

    requested = os.path.join(DIST_DIR, path)
    if path and os.path.exists(requested):
        return send_from_directory(DIST_DIR, path)
    return send_from_directory(DIST_DIR, "index.html")


if __name__ == "__main__":
    app.run(host="0.0.0.0", port=3456, debug=False)
