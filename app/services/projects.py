from __future__ import annotations

import os
import uuid
from pathlib import Path

from sqlalchemy import select

from ..config import PROJECT_ROOT, now_iso
from ..db.models import ProjectRecord, ProjectArtifactRecord
from ..db.session import SessionLocal

PROJECTS_ROOT = Path(os.environ.get("PROJECTS_ROOT", str(PROJECT_ROOT / "workspace" / "projects"))).expanduser()


def serialize(row):
    return {column.name: getattr(row, column.name) for column in row.__table__.columns}


def required(value, label, limit=200):
    if not isinstance(value, str) or not value.strip() or len(value) > limit:
        raise ValueError(f"{label}不能为空，且不得超过 {limit} 字符")
    return value.strip()


def list_projects():
    with SessionLocal() as db:
        return [serialize(row) for row in db.scalars(select(ProjectRecord).order_by(ProjectRecord.created_at.desc()))]


def get_project(project_id):
    with SessionLocal() as db:
        row = db.get(ProjectRecord, project_id)
        if row is None:
            raise ValueError("项目不存在")
        return serialize(row)


def create_project(name, description=""):
    name = required(name, "项目名称")
    if not isinstance(description, str) or len(description) > 20000:
        raise ValueError("项目说明不得超过 20000 字符")
    project_id = uuid.uuid4().hex
    root = PROJECTS_ROOT.resolve() / project_id
    root.mkdir(parents=True, exist_ok=False)
    for directory in ("docs", "src", "tests", "deliverables"):
        (root / directory).mkdir()
    (root / "PROJECT.md").write_text(
        f"# {name}\n\n项目 ID：{project_id}\n\n## 目标与约束\n\n{description or '待补充'}\n\n"
        "## 验收标准\n\n- 请在开始任务前补充交付清单与验证方法。\n\n"
        "## 协作约定\n\n- docs/ 保存需求、设计、测试报告；src/ 保存代码；tests/ 保存测试；deliverables/ 保存最终交付。\n"
        "- Leader 按文件或目录分工，避免同时修改同一文件。并行代码开发需要时使用独立 Git worktree，由集成任务合并。\n"
        "- 产物完成后调用 register_project_artifact 登记相对路径、当前 Kanban 任务 ID、Agent ID、摘要和验证结果。\n"
        "- 登记不代表验收通过，Leader 应检查文件及验证结果。\n", encoding="utf-8")
    with SessionLocal() as db:
        row = ProjectRecord(project_id=project_id, name=name, description=description,
                            workspace_path=str(root), created_at=now_iso())
        db.add(row)
        db.commit()
        return serialize(row)


def project_for_task(runtime_store, task_id="", user_task_id=""):
    links = runtime_store.snapshot().get("kanban_task_links", [])
    candidates = [link for link in links if task_id and link.get("kanban_task_id") == task_id]
    candidates += [link for link in links if user_task_id and (
        link.get("local_id") == user_task_id or link.get("parent_local_id") == user_task_id
        or (link.get("metadata") or {}).get("user_task_id") == user_task_id)]
    ids = {(link.get("metadata") or {}).get("project_id") for link in candidates}
    ids.discard(None)
    ids.discard("")
    if len(ids) > 1:
        raise ValueError("任务关联到不同项目，不能继续派发")
    return get_project(ids.pop()) if ids else None


def metadata(project):
    return {"project_id": project["project_id"], "project_workspace": project["workspace_path"]} if project else {}


def instructions(project):
    if not project:
        return ""
    return (f"[PROJECT]\nproject_id: {project['project_id']}\n项目：{project['name']}\n"
            f"统一工作目录：{project['workspace_path']}\n"
            "先阅读 PROJECT.md 和 docs/ 中的现有资料。所有资料和交付文件写入项目目录，使用相对路径；不要放到个人工作区。\n"
            "按文件分工，避免并行覆盖。交付后调用 mcp_agent_bus_register_project_artifact(project_id, path, title, task_id, agent_id, summary, validation)，"
            "task_id 使用当前 Kanban 任务 ID。若 Worker 没有该 MCP 工具，在完成摘要中返回产物相对路径、名称、任务 ID 和验证结果，由 Leader 登记。"
            "登记文件、任务、负责人和验证结果后再完成任务；Leader 根据实际文件验收。\n\n")


def workspace(project, fallback):
    # Lazy fallback avoids creating unrelated personal workspaces for project tasks.
    return f"dir:{project['workspace_path']}" if project else fallback()


def artifact_path(project, value):
    value = required(value, "产物相对路径", 1000)
    path = Path(value)
    if path.is_absolute() or path.drive or ".." in path.parts or "\\" in value or ":" in value:
        raise ValueError("产物必须使用项目内的相对路径")
    root = Path(project["workspace_path"]).resolve()
    resolved = (root / path).resolve()
    if not resolved.is_relative_to(root) or not resolved.is_file():
        raise ValueError("文件不存在或位于项目目录之外")
    return resolved, path.as_posix()


def register_artifact(runtime_store, project_id, path, title, task_id, agent_id="", summary="", validation=""):
    project = get_project(project_id)
    _, path = artifact_path(project, path)
    title = required(title, "产物名称")
    task_id = required(task_id, "任务 ID", 120)
    linked = project_for_task(runtime_store, task_id=task_id)
    if not linked or linked["project_id"] != project_id:
        raise ValueError("产物任务不属于当前项目")
    if agent_id and not runtime_store.find_agent(agent_id):
        raise ValueError("Agent 不存在")
    if any(not isinstance(value, str) or len(value) > 20000 for value in (summary, validation)):
        raise ValueError("摘要或验证结果过长")
    with SessionLocal() as db:
        row = db.scalar(select(ProjectArtifactRecord).where(ProjectArtifactRecord.project_id == project_id,
                                                           ProjectArtifactRecord.path == path))
        if row is None:
            row = ProjectArtifactRecord(artifact_id=uuid.uuid4().hex, project_id=project_id, path=path)
            db.add(row)
        row.title, row.task_id, row.agent_id = title, task_id, agent_id
        row.summary, row.validation, row.updated_at = summary, validation, now_iso()
        db.commit()
        return serialize(row)


def detail(runtime_store, project_id):
    project = get_project(project_id)
    with SessionLocal() as db:
        artifacts = [serialize(row) for row in db.scalars(select(ProjectArtifactRecord)
            .where(ProjectArtifactRecord.project_id == project_id).order_by(ProjectArtifactRecord.updated_at.desc()))]
    for item in artifacts:
        try:
            artifact_path(project, item["path"])
            item["exists"] = True
        except ValueError:
            item["exists"] = False
    tasks = [link for link in runtime_store.snapshot().get("kanban_task_links", [])
             if (link.get("metadata") or {}).get("project_id") == project_id]
    return {"project": project, "tasks": tasks, "artifacts": artifacts}


def list_files(project_id):
    project = get_project(project_id)
    root = Path(project["workspace_path"]).resolve()
    files = []
    for directory, dirs, names in os.walk(root, followlinks=False):
        dirs[:] = sorted(d for d in dirs if not d.startswith('.') and d not in ('node_modules', '__pycache__')
                          and not (Path(directory) / d).is_symlink())
        for name in sorted(names):
            candidate = Path(directory) / name
            if name.startswith('.') or candidate.is_symlink():
                continue
            if candidate.is_file() and candidate.resolve().is_relative_to(root):
                files.append(candidate.relative_to(root).as_posix())
                if len(files) >= 500:
                    return {"files": files, "truncated": True}
    return {"files": files, "truncated": False}
