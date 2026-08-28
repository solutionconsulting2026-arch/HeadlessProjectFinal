import { NextResponse } from "next/server";
import { McpClient, mcpDiagnostics } from "@/lib/mcp/client";
import { auditLogger } from "@/lib/security/audit";

export const runtime = "nodejs";

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
    });
  } catch (err: any) {
    return NextResponse.json({
      connectionStatus: "Error",
      lastError: err.message,
      discoveredTools: [],
      lastToolInvocation: mcpDiagnostics.lastExecution,
      executionHistory: mcpDiagnostics.executionHistory,
      auditTrail: auditLogger.getRecords(),
    });
  }
}
