from __future__ import annotations

from flask import Flask

from .agents import bp as agents_bp
from .agent_chats import bp as agent_chats_bp
from .agent_mcps import bp as agent_mcps_bp
from .events import bp as events_bp
from .kanban import bp as kanban_bp
from .messages import bp as messages_bp
from .org import bp as org_bp
from .teams import bp as teams_bp
from .model_configs import bp as model_configs_bp
from .transfer import bp as transfer_bp
from .web import bp as web_bp
from .projects import bp as projects_bp
from .system import bp as system_bp


def register_blueprints(app: Flask) -> None:
    app.register_blueprint(web_bp)
    app.register_blueprint(projects_bp)
    app.register_blueprint(agents_bp)
    app.register_blueprint(agent_chats_bp)
    app.register_blueprint(agent_mcps_bp)
    app.register_blueprint(kanban_bp)
    app.register_blueprint(messages_bp)
    app.register_blueprint(teams_bp)
    app.register_blueprint(org_bp)
    app.register_blueprint(model_configs_bp)
    app.register_blueprint(transfer_bp)
    app.register_blueprint(events_bp)
    app.register_blueprint(system_bp)
