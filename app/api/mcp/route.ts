import { NextResponse } from "next/server";
import { McpClient, mcpDiagnostics } from "@/lib/mcp/client";
import { auditLogger } from "@/lib/security/audit";
import { llmDiagnostics } from "@/lib/ai/orchestrator";

export const runtime = "nodejs";

function getLlmProviderStatus() {
  // Computed directly from env vars on every request (rather than solely trusting the
  // llmDiagnostics singleton, which may live in a different warm server instance than
  // this route) so "configured" is always accurate. lastUsedProvider/lastError below are
  // best-effort — they only reflect calls made from this same server instance.
  const anthropicConfigured = !!process.env.ANTHROPIC_API_KEY;
  const openaiConfigured = !!process.env.OPENAI_API_KEY;
  const configured = anthropicConfigured ? "anthropic" : openaiConfigured ? "openai" : "none";
  const model = configured === "anthropic"
    ? process.env.ANTHROPIC_MODEL || "claude-sonnet-5"
    : configured === "openai"
    ? process.env.OPENAI_MODEL || "gpt-5.6-terra"
    : null;

  return {
    configured,
    model,
    anthropicConfigured,
    openaiConfigured,
    lastUsedProvider: llmDiagnostics.lastUsedProvider,
    lastError: llmDiagnostics.lastError,
    lastErrorProvider: llmDiagnostics.lastErrorProvider,
    lastSuccessAt: llmDiagnostics.lastSuccessAt,
  };
}

export async function GET() {
  try {
    const client = new McpClient();
    const tools = await client.listTools();

    return NextResponse.json({
      connectionStatus: mcpDiagnostics.connectionStatus,
      lastError: mcpDiagnostics.lastError,
      discoveredTools: tools,
      lastToolInvocation: mcpDiagnostics.lastExecution,
      executionHistory: mcpDiagnostics.executionHistory,
      auditTrail: auditLogger.getRecords(),
      llmProvider: getLlmProviderStatus(),
    });
  } catch (err: any) {
    return NextResponse.json({
      connectionStatus: "Error",
      lastError: err.message,
      discoveredTools: [],
      lastToolInvocation: mcpDiagnostics.lastExecution,
      executionHistory: mcpDiagnostics.executionHistory,
      auditTrail: auditLogger.getRecords(),
      llmProvider: getLlmProviderStatus(),
    });
  }
}
