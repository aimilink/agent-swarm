from flask import Blueprint, jsonify, request, send_file

from ..models.store import store
from ..services import projects
from ..services.messages import send_user_task

bp = Blueprint("projects", __name__, url_prefix="/api/projects")


@bp.errorhandler(ValueError)
def invalid(exc):
    return jsonify(ok=False, error=str(exc)), 400


def payload():
    data = request.get_json(silent=True)
    if not isinstance(data, dict):
        raise ValueError("请求必须是 JSON 对象")
    return data


@bp.get("")
def list_projects():
    return jsonify(ok=True, projects=projects.list_projects(store))


@bp.post("")
def create_project():
    data = payload()
    return jsonify(ok=True, project=projects.create_project(
        data.get("name"), data.get("description", ""), data.get("team_ids", []), store)), 201


@bp.get("/<project_id>")
def project_detail(project_id):
    return jsonify(ok=True, **projects.detail(store, project_id))


@bp.put("/<project_id>/teams")
def update_project_teams(project_id):
    data = payload()
    return jsonify(ok=True, project=projects.set_project_teams(store, project_id, data.get("team_ids")))


@bp.post("/<project_id>/tasks")
def create_task(project_id):
    data = payload()
    content = projects.required(data.get("content"), "任务内容", 20000)
    agent_id = projects.required(data.get("to_agent_id"), "接收 Agent", 120)
    project_detail = projects.detail(store, project_id)
    project = project_detail["project"]
    projects.ensure_agent_in_project(store, project, store.find_agent(agent_id))
    iteration = project_detail["next_iteration"]
    return jsonify(
        ok=True,
        iteration=iteration,
        message=send_user_task(
            store,
            content=content,
            to_agent_id=agent_id,
            project_id=project_id,
            project_iteration=iteration,
        ),
    ), 201


@bp.post("/<project_id>/artifacts")
def register_artifact(project_id):
    data = payload()
    return jsonify(ok=True, artifact=projects.register_artifact(store, project_id,
        path=data.get("path"), title=data.get("title"), task_id=data.get("task_id"),
        agent_id=data.get("agent_id", ""), summary=data.get("summary", ""), validation=data.get("validation", ""))), 201


@bp.get("/<project_id>/file")
def download_file(project_id):
    project = projects.get_project(project_id)
    path, _ = projects.artifact_path(project, request.args.get("path"))
    return send_file(path, as_attachment=True)


@bp.get("/<project_id>/files")
def files(project_id):
    return jsonify(ok=True, **projects.list_files(project_id))


@bp.get("/<project_id>/workspace")
def project_workspace(project_id):
    return jsonify(ok=True, **projects.workspace_snapshot(
        store, project_id, task_id=(request.args.get("task_id") or "").strip()
    ))


@bp.get("/<project_id>/preview")
def preview_file(project_id):
    result = projects.preview_file(project_id, request.args.get("path"))
    if result["preview_type"] == "text":
        return jsonify(
            ok=True,
            path=result["relative_path"],
            preview_type="text",
            mime_type=result["mime_type"],
            size=result["size"],
            modified_ns=result["modified_ns"],
            encoding=result["encoding"],
            content=result["content"],
        )
    if result["preview_type"] in {"image", "pdf"}:
        return send_file(
            result["path"],
            as_attachment=False,
            conditional=True,
            mimetype=result["mime_type"],
            max_age=0,
        )
    raise ValueError("该文件不支持在线预览，请下载后查看")
