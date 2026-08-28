import { NextResponse, NextRequest } from "next/server";
import { McpClient } from "@/lib/mcp/client";
import { auditLogger } from "@/lib/security/audit";

export const runtime = "nodejs";

const mcpClient = new McpClient();

export async function POST(req: NextRequest) {
  const startTime = Date.now();
  let actionName = "unknown";
  let cid = "default";
  
  try {
    const body = await req.json();
    const { action, payload, conversationId } = body;
    actionName = action;
    cid = conversationId || "default";

    if (!action || !payload) {
      return NextResponse.json(
        { error: "Action and payload are required" },
        { status: 400 }
      );
    }

    console.log(`[ACTION_ROUTE] Initiating write action: ${action} | Conversation: ${cid}`);

    // Call the actual remote MCP tool
    const result = await mcpClient.callTool(action, payload);

    // Log write audit
    auditLogger.log({
      conversationId: cid,
      userId: "admin-dev",
      toolName: action,
      actionCategory: "WRITE",
      status: "success",
      durationMs: Date.now() - startTime,
      message: `Action executed successfully`
    });

    return NextResponse.json({
      status: "success",
      message: `${action} executed successfully`,
      data: result
    });
  } catch (err: any) {
    console.error(`[ACTION_ROUTE_ERROR] Error executing write action ${actionName}:`, err);

    // Log write failure audit
    auditLogger.log({
      conversationId: cid,
      userId: "admin-dev",
      toolName: actionName,
      actionCategory: "WRITE",
      status: "error",
      durationMs: Date.now() - startTime,
      message: err.message || "Execution failed"
    });

    return NextResponse.json(
      {
        status: "error",
        message: err.message || "Failed to execute CRM write action.",
      },
      { status: 500 }
    );
  }
}
