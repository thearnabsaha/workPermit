import { StateGraph, START, END } from "@langchain/langgraph";
import { GraphState, type GraphStateType } from "./state";
import type { InputFile } from "../ocr";
import {
  analyticsNode,
  classifyNode,
  expiryNode,
  extractNode,
  languageNode,
  notifyNode,
  ocrNode,
  recommendNode,
  riskNode,
  routeAfterClassify,
  uploadNode,
  validateNode,
} from "./nodes";

// The 11-agent work-permit validation workflow. Each node updates shared state
// and appends safe trace steps; the route handler streams those to the UI.
export function buildGraph() {
  // Node names must not collide with state channel names (ocr, language, risk,
  // expiry, ...), so every node carries a "_step" suffix.
  const graph = new StateGraph(GraphState)
    .addNode("upload_step", uploadNode)
    .addNode("ocr_step", ocrNode)
    .addNode("language_step", languageNode)
    .addNode("classify_step", classifyNode)
    .addNode("extract_step", extractNode)
    .addNode("validate_step", validateNode)
    .addNode("risk_step", riskNode)
    .addNode("expiry_step", expiryNode)
    .addNode("recommend_step", recommendNode)
    .addNode("notify_step", notifyNode)
    .addNode("analytics_step", analyticsNode)
    .addEdge(START, "upload_step")
    .addEdge("upload_step", "ocr_step")
    .addEdge("ocr_step", "language_step")
    .addEdge("language_step", "classify_step")
    .addConditionalEdges("classify_step", routeAfterClassify, { extract: "extract_step", recommend: "recommend_step" })
    .addEdge("extract_step", "validate_step")
    .addEdge("validate_step", "risk_step")
    .addEdge("risk_step", "expiry_step")
    .addEdge("expiry_step", "recommend_step")
    .addEdge("recommend_step", "notify_step")
    .addEdge("notify_step", "analytics_step")
    .addEdge("analytics_step", END);

  return graph.compile();
}

let _compiled: ReturnType<typeof buildGraph> | null = null;
export function getGraph() {
  if (!_compiled) _compiled = buildGraph();
  return _compiled;
}

export function createInitialState(files: InputFile[], message: string): Partial<GraphStateType> {
  return { files, message };
}
