"""API Bearer token 鉴权：保护所有 /api/* 端点。

环境变量 AGENT_TEAM_API_TOKEN 未设置时跳过鉴权（本地开发兼容）。
SSE（EventSource 无法设 Header）支持 query param ?token=。
"""

from __future__ import annotations

import os

from flask import Flask, jsonify, request


def get_api_token() -> str:
    return (os.environ.get("AGENT_TEAM_API_TOKEN") or "").strip()


def extract_request_token() -> str:
    auth = request.headers.get("Authorization") or ""
    if auth.lower().startswith("bearer "):
        return auth[7:].strip()
    # EventSource / SSE 无法设置 Authorization header
    return (request.args.get("token") or "").strip()


def unauthorized_response():
    return jsonify({"ok": False, "error": "unauthorized"}), 401


def register_api_auth(app: Flask) -> None:
    @app.before_request
    def require_api_token():  # noqa: ANN202
        if not request.path.startswith("/api/"):
            return None
        expected = get_api_token()
        if not expected:
            return None
        if extract_request_token() != expected:
            return unauthorized_response()
        return None
