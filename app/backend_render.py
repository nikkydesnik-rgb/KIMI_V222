#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Backend DOCX renderer (Python/docxtpl) for stable template filling.
Run: python backend_render.py
"""

import base64
import io
from flask import Flask, jsonify, request
from docxtpl import DocxTemplate

app = Flask(__name__)


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


if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5001, debug=False)

