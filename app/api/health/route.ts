import { NextResponse } from "next/server";
import { McpClient, mcpDiagnostics } from "@/lib/mcp/client";

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

  const openAiStatus = process.env.OPENAI_API_KEY ? "Connected" : "Not Configured";

  return NextResponse.json({
    status: "Healthy",
    services: {
      application: { status: "Connected" },
      openai: { status: openAiStatus, model: process.env.OPENAI_MODEL || "gpt-5.6-terra" },
      crm_mcp: { 
        status: mcpStatus, 
        url: "https://headlessmcp.vercel.app/mcp",
        discoveredToolsCount: toolCount,
        lastError: mcpDiagnostics.lastError
      }
    }
  });
}
