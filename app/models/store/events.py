"""SSE subscription + event broadcast for RuntimeStore."""
from __future__ import annotations

import json
import queue
from itertools import count as _count

from ...config import now_iso
from .base import NON_PERSISTED_EVENT_TYPES


class EventsMixin:
    def subscribe(self) -> queue.Queue[str]:
        # Bound per-client buffers so a slow or disconnected browser cannot
        # retain an unlimited number of high-frequency runtime events.
        q: queue.Queue[str] = queue.Queue(maxsize=256)
        with self._lock:
            self._subscribers.append(q)
        return q

    def unsubscribe(self, q: queue.Queue[str]) -> None:
        with self._lock:
            if q in self._subscribers:
                self._subscribers.remove(q)

    def _broadcast(self, payload: str) -> None:
        with self._lock:
            subscribers = list(self._subscribers)
        for subscriber in subscribers:
            try:
                subscriber.put_nowait(payload)
            except queue.Full:
                try:
                    subscriber.get_nowait()
                except queue.Empty:
                    pass
                try:
                    subscriber.put_nowait(payload)
                except queue.Full:
                    pass

    def push_event(
        self, event_type: str, agent_id: str, task_id: str | None, data: dict
    ) -> dict:
        event = {
            "id": f"evt_{next(self._event_ids):04d}",
            "event_type": event_type,
            "agent_id": agent_id,
            "task_id": task_id,
            "timestamp": now_iso(),
            "data": data,
        }
        payload = f"event: event\ndata: {json.dumps(event, ensure_ascii=False)}\n\n"
        with self._lock:
            self.events.appendleft(event)
        self._broadcast(payload)
        if event_type not in NON_PERSISTED_EVENT_TYPES:
            self._persist("insert_event", event)
        return event

    def push_agents_changed(self) -> None:
        with self._lock:
            agent_rows = [dict(agent) for agent in self.agents]
            teams = list(self.teams)
            stats = self._build_stats()
        body = {"agents": self._sorted_agent_rows(agent_rows), "teams": teams, "stats": stats}
        payload = f"event: agents\ndata: {json.dumps(body, ensure_ascii=False)}\n\n"
        self._broadcast(payload)


# Re-export for callers that historically imported `count` from the module.
_ = _count
