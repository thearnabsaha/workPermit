"""The 11-agent work-permit validation workflow (LangGraph StateGraph).

Node names carry a ``_step`` suffix because LangGraph forbids node names that
collide with state channel names (e.g. ``ocr``, ``risk``, ``expiry``).
"""
from __future__ import annotations

from langgraph.graph import END, START, StateGraph

from . import nodes
from .state import GraphState

_compiled = None


def build_graph():
    graph = StateGraph(GraphState)
    graph.add_node("upload_step", nodes.upload_node)
    graph.add_node("ocr_step", nodes.ocr_node)
    graph.add_node("language_step", nodes.language_node)
    graph.add_node("classify_step", nodes.classify_node)
    graph.add_node("extract_step", nodes.extract_node)
    graph.add_node("validate_step", nodes.validate_node)
    graph.add_node("risk_step", nodes.risk_node)
    graph.add_node("expiry_step", nodes.expiry_node)
    graph.add_node("recommend_step", nodes.recommend_node)
    graph.add_node("notify_step", nodes.notify_node)
    graph.add_node("analytics_step", nodes.analytics_node)

    graph.add_edge(START, "upload_step")
    graph.add_edge("upload_step", "ocr_step")
    graph.add_edge("ocr_step", "language_step")
    graph.add_edge("language_step", "classify_step")
    graph.add_conditional_edges(
        "classify_step",
        nodes.route_after_classify,
        {"extract": "extract_step", "recommend": "recommend_step"},
    )
    graph.add_edge("extract_step", "validate_step")
    graph.add_edge("validate_step", "risk_step")
    graph.add_edge("risk_step", "expiry_step")
    graph.add_edge("expiry_step", "recommend_step")
    graph.add_edge("recommend_step", "notify_step")
    graph.add_edge("notify_step", "analytics_step")
    graph.add_edge("analytics_step", END)

    return graph.compile()


def get_graph():
    global _compiled
    if _compiled is None:
        _compiled = build_graph()
    return _compiled
