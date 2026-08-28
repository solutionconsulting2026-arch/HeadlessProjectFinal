import { NextResponse } from "next/server";
import { McpClient, mcpDiagnostics } from "@/lib/mcp/client";
import { llmDiagnostics } from "@/lib/ai/orchestrator";

export const runtime = "nodejs";

export async function GET() {
  let mcpStatus = "Disconnected";
  let toolCount = 0;

  try {
    const client = new McpClient();
    const tools = await client.listTools();
    if (tools && tools.length > 0) {
      mcpStatus = "Connected";
      toolCount = tools.length;
    } else {
      mcpStatus = "Connected (No Tools)";
    }
  } catch (err) {
    mcpStatus = "Error";
    console.error("[HEALTH CHECK] MCP Connection failed:", err);
  }

  // "Configured" only means the env var is a non-empty string — it does NOT mean the key
  // is valid. lastUsedProvider/lastError (best-effort, from this server instance's recent
  // calls) is the real signal for whether the LLM path is actually working.
  const anthropicConfigured = !!process.env.ANTHROPIC_API_KEY;
  const openaiConfigured = !!process.env.OPENAI_API_KEY;

  return NextResponse.json({
    status: "Healthy",
    services: {
      application: { status: "Connected" },
      anthropic: {
        status: anthropicConfigured ? "Configured" : "Not Configured",
        model: process.env.ANTHROPIC_MODEL || "claude-sonnet-5"
      },
      openai: {
        status: openaiConfigured ? "Configured" : "Not Configured",
        model: process.env.OPENAI_MODEL || "gpt-5.6-terra"
      },
      llm_runtime: {
        activeProvider: anthropicConfigured ? "anthropic" : openaiConfigured ? "openai" : "none (using local fallback router)",
        lastUsedProvider: llmDiagnostics.lastUsedProvider,
        lastError: llmDiagnostics.lastError,
        lastErrorProvider: llmDiagnostics.lastErrorProvider,
        lastSuccessAt: llmDiagnostics.lastSuccessAt
      },
      crm_mcp: {
        status: mcpStatus,
        url: "https://headlessmcp.vercel.app/mcp",
        discoveredToolsCount: toolCount,
        lastError: mcpDiagnostics.lastError
      }
    }
  });
}
