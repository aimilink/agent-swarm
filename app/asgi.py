from __future__ import annotations

import asyncio
import codecs
import logging
from contextlib import suppress

from a2wsgi import WSGIMiddleware
from starlette.applications import Starlette
from starlette.routing import Mount, WebSocketRoute
from starlette.websockets import WebSocket, WebSocketDisconnect

from . import create_app
from .controllers.auth import websocket_authenticated
from .mcp_server import mcp_asgi_app
from .models.store import store
from .services import projects
from .services.acp import TERMINAL_QUEUE_CLOSE_SENTINEL, pool as session_pool
from .services.workspace_shell import WorkspaceShell

logger = logging.getLogger("hermes.agent_state")


async def terminal_ws(websocket: WebSocket) -> None:
    agent_id = websocket.path_params["agent_id"]
    await websocket.accept()
    logger.warning("[terminal-ws] accept agent=%s client=%s", agent_id, getattr(websocket, "client", None))

    agent = store.find_agent(agent_id)
    if agent is None:
        await websocket.send_json(
            {"type": "status", "status": "error", "message": "agent not found"}
        )
        logger.warning("[terminal-ws] missing agent=%s", agent_id)
        await websocket.close(code=4404)
        return

    try:
        subscriber, state = session_pool.attach_terminal(agent_id)
    except RuntimeError as exc:
        await websocket.send_json(
            {"type": "status", "status": "not_running", "message": str(exc)}
        )
        logger.warning("[terminal-ws] attach failed agent=%s error=%s", agent_id, exc)
        await websocket.close(code=4409)
        return

    async def pump_terminal_output() -> None:
        while True:
            message = await asyncio.to_thread(subscriber.get)
            if message == TERMINAL_QUEUE_CLOSE_SENTINEL:
                logger.warning("[terminal-ws] close sentinel agent=%s", agent_id)
                return
            await websocket.send_json(message)
            if message.get("type") != "output":
                logger.warning("[terminal-ws] send agent=%s type=%s", agent_id, message.get("type"))
            if message.get("type") == "status":
                return

    try:
        await websocket.send_json(
            {
                "type": "ready",
                "rows": state["rows"],
                "cols": state["cols"],
                "snapshot_text": state["snapshot_text"],
                "snapshot_ansi": state["snapshot_ansi"],
            }
        )
        logger.warning(
            "[terminal-ws] ready agent=%s rows=%s cols=%s snapshot_text_len=%s snapshot_ansi_len=%s",
            agent_id,
            state["rows"],
            state["cols"],
            len(state["snapshot_text"]),
            len(state["snapshot_ansi"]),
        )

        output_task = asyncio.create_task(pump_terminal_output())
        while True:
            receive_task = asyncio.create_task(websocket.receive_json())
            done, pending = await asyncio.wait(
                {output_task, receive_task},
                return_when=asyncio.FIRST_COMPLETED,
            )
            if receive_task in pending:
                receive_task.cancel()
                with suppress(asyncio.CancelledError):
                    await receive_task
            if output_task in done:
                with suppress(asyncio.CancelledError):
                    await output_task
                break
            payload = receive_task.result()
            message_type = payload.get("type")
            if message_type == "input":
                logger.warning(
                    "[terminal-ws] input agent=%s bytes=%s",
                    agent_id,
                    len(str(payload.get("data") or "")),
                )
                session_pool.send_terminal_data(agent_id, str(payload.get("data") or ""))
                continue
            if message_type == "resize":
                logger.warning(
                    "[terminal-ws] resize agent=%s rows=%s cols=%s",
                    agent_id,
                    payload.get("rows"),
                    payload.get("cols"),
                )
                session_pool.resize_terminal(
                    agent_id,
                    int(payload.get("rows") or 0),
                    int(payload.get("cols") or 0),
                )
                continue
            if message_type == "ping":
                await websocket.send_json({"type": "pong"})
    except (WebSocketDisconnect, RuntimeError):
        logger.warning("[terminal-ws] disconnect agent=%s", agent_id)
    finally:
        session_pool.detach_terminal(agent_id, subscriber)
        if "output_task" in locals():
            output_task.cancel()
            with suppress(asyncio.CancelledError):
                await output_task


async def workspace_terminal_ws(websocket: WebSocket) -> None:
    project_id = websocket.path_params["project_id"]
    try:
        project = projects.get_project(project_id)
    except ValueError:
        await websocket.accept()
        await websocket.send_json({"type": "status", "status": "error", "message": "project not found"})
        await websocket.close(code=4404)
        return
    shell = WorkspaceShell(project["workspace_path"])
    await websocket.accept()
    try:
        shell.start()
    except RuntimeError as exc:
        await websocket.send_json({"type": "status", "status": "error", "message": str(exc)})
        await websocket.close(code=4409)
        return

    async def pump_output() -> None:
        decoder = codecs.getincrementaldecoder("utf-8")("replace")
        while True:
            chunk = await asyncio.to_thread(shell.read)
            if chunk:
                await websocket.send_json({"type": "output", "data": decoder.decode(chunk)})
                continue
            if shell.poll() is not None:
                tail = decoder.decode(b"", final=True)
                if tail:
                    await websocket.send_json({"type": "output", "data": tail})
                await websocket.send_json({"type": "status", "status": "closed", "message": "Shell 已退出"})
                return

    try:
        await websocket.send_json({
            "type": "ready",
            "rows": shell.rows,
            "cols": shell.cols,
            "cwd": str(shell.cwd),
        })
        output_task = asyncio.create_task(pump_output())
        while True:
            receive_task = asyncio.create_task(websocket.receive_json())
            done, pending = await asyncio.wait({output_task, receive_task}, return_when=asyncio.FIRST_COMPLETED)
            if receive_task in pending:
                receive_task.cancel()
                with suppress(asyncio.CancelledError):
                    await receive_task
            if output_task in done:
                with suppress(asyncio.CancelledError):
                    await output_task
                break
            payload = receive_task.result()
            if payload.get("type") == "input":
                data = str(payload.get("data") or "")
                if len(data) <= 65536:
                    shell.write(data)
            elif payload.get("type") == "resize":
                shell.resize(int(payload.get("rows") or shell.rows), int(payload.get("cols") or shell.cols))
            elif payload.get("type") == "ping":
                await websocket.send_json({"type": "pong"})
    except (WebSocketDisconnect, RuntimeError):
        pass
    finally:
        if "output_task" in locals():
            output_task.cancel()
            with suppress(asyncio.CancelledError):
                await output_task
        await asyncio.to_thread(shell.close)


def create_asgi_app() -> Starlette:
    flask_app = create_app()

    # Feishu webhook notifier: forward user_task lifecycle events (completed /
    # blocked / interaction required) to a Feishu custom bot. No-op unless
    # AGENTSWARM_FEISHU_WEBHOOK is set; failures never affect the pipeline.
    from .services.feishu_notifier import FeishuNotifier

    FeishuNotifier(store)

    async def protected_agent_terminal(websocket: WebSocket) -> None:
        if not websocket_authenticated(websocket, flask_app):
            await websocket.close(code=4401)
            return
        await terminal_ws(websocket)

    async def protected_workspace_terminal(websocket: WebSocket) -> None:
        if not websocket_authenticated(websocket, flask_app):
            await websocket.close(code=4401)
            return
        await workspace_terminal_ws(websocket)

    return Starlette(
        routes=[
            WebSocketRoute("/api/agents/{agent_id:str}/terminal/ws", protected_agent_terminal),
            WebSocketRoute("/api/projects/{project_id:str}/terminal/ws", protected_workspace_terminal),
            Mount("/mcp", app=mcp_asgi_app),
            Mount("/", app=WSGIMiddleware(flask_app)),
        ]
    )
