import { NextResponse, NextRequest } from "next/server";
import { AIOrchestrator } from "@/lib/ai/orchestrator";

// Force Node.js runtime since we are making raw HTTP requests
export const runtime = "nodejs";

const orchestrator = new AIOrchestrator();

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { message, conversationId, mode, history } = body;

    if (!message) {
      return NextResponse.json(
        { error: "Message is required" },
        { status: 400 }
      );
    }

    const cid = conversationId || "default-conv-id";
    const activeMode = mode === "retail" ? "retail" : "corporate";
    const response = await orchestrator.processMessage(message, cid, activeMode, history);

    return NextResponse.json(response);
  } catch (err: any) {
    console.error("[AGENT_ROUTE_ERROR]", err);
    return NextResponse.json(
      {
        version: "1.0",
        title: "Internal Server Error",
        subtitle: "Request Execution Failed",
        message: "An internal server error occurred while processing the request.",
        components: [
          {
            type: "error",
            title: "Execution Error",
            data: { error: err.message || "Unknown error" }
          }
        ]
      },
      { status: 500 }
    );
  }
}
