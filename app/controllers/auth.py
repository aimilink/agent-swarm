"""Browser login sessions and backward-compatible API bearer authentication."""

from __future__ import annotations

import os
import secrets
from datetime import timedelta
from pathlib import Path
from urllib.parse import urlsplit

from flask import Flask, Blueprint, current_app, jsonify, redirect, render_template, request, session, url_for

from ..services.auth import AuthService

bp = Blueprint("auth", __name__)
PUBLIC_ENDPOINTS = {"auth.login", "static"}


def get_api_token() -> str:
    return (os.environ.get("AGENT_TEAM_API_TOKEN") or "").strip()


def extract_request_token() -> str:
    auth = request.headers.get("Authorization") or ""
    if auth.lower().startswith("bearer "):
        return auth[7:].strip()
    return (request.args.get("token") or "").strip()


def unauthorized_response(message: str = "unauthorized"):
    return jsonify({"ok": False, "error": message}), 401


def _service() -> AuthService:
    return current_app.extensions["agent_team_auth"]


def _session_authenticated() -> bool:
    return bool(session.get("authenticated"))


def _csrf_token() -> str:
    token = session.get("csrf_token")
    if not token:
        token = secrets.token_urlsafe(24)
        session["csrf_token"] = token
    return token


def _valid_csrf() -> bool:
    supplied = request.form.get("csrf_token") or request.headers.get("X-CSRF-Token") or ""
    expected = session.get("csrf_token") or ""
    return bool(supplied and expected and secrets.compare_digest(supplied, expected))


def _safe_next(value: str | None) -> str:
    value = (value or "").strip()
    parsed = urlsplit(value)
    if not value.startswith("/") or value.startswith("//") or parsed.scheme or parsed.netloc:
        return "/"
    return value


def _session_secret() -> str:
    configured = (os.environ.get("AGENT_TEAM_SESSION_SECRET") or "").strip()
    if configured:
        return configured
    path = Path(__file__).resolve().parents[2] / "data" / ".session-secret"
    path.parent.mkdir(parents=True, exist_ok=True)
    try:
        secret = path.read_text(encoding="utf-8").strip()
    except OSError:
        secret = ""
    if not secret:
        secret = secrets.token_urlsafe(48)
        path.write_text(secret, encoding="utf-8")
        try:
            path.chmod(0o600)
        except OSError:
            pass
    return secret


@bp.route("/login", methods=["GET", "POST"])
def login():
    service = _service()
    next_url = _safe_next(request.values.get("next"))
    if _session_authenticated() and not session.get("must_change_password"):
        return redirect(next_url)
    error = ""
    if request.method == "POST":
        if not _valid_csrf():
            error = "页面已过期，请刷新后重试"
        elif service.verify(request.form.get("username", ""), request.form.get("password", "")):
            session.clear()
            session.permanent = True
            session["authenticated"] = True
            session["username"] = service.default_username
            session["must_change_password"] = not service.password_changed()
            _csrf_token()
            if session["must_change_password"]:
                return redirect(url_for("auth.change_password"))
            return redirect(next_url)
        else:
            error = "账号或密码错误"
    return render_template(
        "login.html",
        error=error,
        username=service.default_username,
        default_password=service.default_password,
        show_default=not service.password_changed(),
        next_url=next_url,
        csrf_token=_csrf_token(),
    )


@bp.route("/change-password", methods=["GET", "POST"])
def change_password():
    if not _session_authenticated():
        return redirect(url_for("auth.login", next=request.full_path))
    service = _service()
    error = ""
    if request.method == "POST":
        if not _valid_csrf():
            error = "页面已过期，请刷新后重试"
        else:
            try:
                service.change_password(
                    request.form.get("current_password", ""),
                    request.form.get("new_password", ""),
                    request.form.get("confirmation", ""),
                )
            except ValueError as exc:
                error = str(exc)
            else:
                session["must_change_password"] = False
                session.modified = True
                return redirect("/")
    return render_template("change_password.html", error=error, csrf_token=_csrf_token())


@bp.post("/logout")
def logout():
    if not _valid_csrf():
        return "Bad Request", 400
    session.clear()
    return redirect(url_for("auth.login"))


def register_login_auth(app: Flask, service: AuthService | None = None) -> None:
    app.secret_key = app.secret_key or _session_secret()
    app.config.update(
        SESSION_COOKIE_HTTPONLY=True,
        SESSION_COOKIE_SAMESITE="Lax",
        SESSION_COOKIE_SECURE=os.environ.get("AGENT_TEAM_COOKIE_SECURE", "0") == "1",
        PERMANENT_SESSION_LIFETIME=timedelta(hours=12),
    )
    auth_service = service or AuthService()
    auth_service.ensure_initialized()
    app.extensions["agent_team_auth"] = auth_service
    app.register_blueprint(bp)

    @app.context_processor
    def auth_context():
        return {
            "auth_csrf_token": _csrf_token(),
            "auth_username": session.get("username", ""),
        }

    @app.before_request
    def require_browser_login():
        if request.endpoint in PUBLIC_ENDPOINTS or request.path.startswith("/static/"):
            return None
        if request.path.startswith("/api/"):
            if _session_authenticated() and session.get("must_change_password"):
                return jsonify(ok=False, error="password_change_required"), 403
            return None
        if request.endpoint in {"auth.change_password", "auth.logout"}:
            return None
        if not _session_authenticated():
            return redirect(url_for("auth.login", next=request.full_path))
        if session.get("must_change_password"):
            return redirect(url_for("auth.change_password"))
        return None

    @app.after_request
    def prevent_auth_page_cache(response):
        if request.endpoint in {"auth.login", "auth.change_password"}:
            response.headers["Cache-Control"] = "no-store"
        return response


def register_api_auth(app: Flask) -> None:
    @app.before_request
    def require_api_token():
        if not request.path.startswith("/api/"):
            return None
        if _session_authenticated() and not session.get("must_change_password"):
            return None
        expected = get_api_token()
        if expected and extract_request_token() == expected:
            return None
        if not expected and "agent_team_auth" not in app.extensions:
            return None
        return unauthorized_response()


def websocket_authenticated(websocket, app: Flask) -> bool:
    expected = get_api_token()
    supplied = (websocket.query_params.get("token") or "").strip()
    if expected and supplied and secrets.compare_digest(supplied, expected):
        return True
    cookie_name = app.config.get("SESSION_COOKIE_NAME", "session")
    cookie = websocket.cookies.get(cookie_name)
    serializer = app.session_interface.get_signing_serializer(app)
    if not cookie or serializer is None:
        return False
    try:
        values = serializer.loads(cookie, max_age=int(app.permanent_session_lifetime.total_seconds()))
    except Exception:
        return False
    return bool(values.get("authenticated")) and not values.get("must_change_password")
