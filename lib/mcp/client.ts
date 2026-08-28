import https from "https";
import http from "http";

export interface McpTool {
  name: string;
  description?: string;
  inputSchema: {
    type: string;
    properties: Record<string, any>;
    required?: string[];
    [key: string]: any;
  };
}

export interface ToolExecutionRecord {
  timestamp: string;
  toolName: string;
  status: "success" | "error";
  durationMs: number;
  error?: string;
  inputArguments?: any;
}

// Global in-memory diagnostics tracker (in serverless context, this lasts for the duration of instance liveness)
class DiagnosticsTracker {
  public lastExecution: ToolExecutionRecord | null = null;
  public executionHistory: ToolExecutionRecord[] = [];
  public connectionStatus: "Connected" | "Disconnected" | "Error" = "Disconnected";
  public lastError: string | null = null;
  
  public logExecution(record: ToolExecutionRecord) {
    this.lastExecution = record;
    this.executionHistory.push(record);
    if (this.executionHistory.length > 50) {
      this.executionHistory.shift();
    }
  }
}

export const mcpDiagnostics = new DiagnosticsTracker();

export class McpClient {
  private serverUrl: string;

  constructor() {
    this.serverUrl = process.env.CRM_MCP_SERVER_URL || "https://headlessmcp.vercel.app/mcp";
  }

  private async postMcpRequest(method: string, params: any = {}): Promise<any> {
    const payload = {
      jsonrpc: "2.0",
      id: Math.floor(Math.random() * 1000000),
      method,
      params
    };

    const data = JSON.stringify(payload);
    const url = new URL(this.serverUrl);
    const startTime = Date.now();

    return new Promise((resolve, reject) => {
      const protocol = url.protocol === "https:" ? https : http;
      const req = protocol.request(
        this.serverUrl,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Content-Length": Buffer.byteLength(data),
            "Accept": "application/json, text/event-stream"
          },
          timeout: 30000
        },
        (res) => {
          let body = "";
          res.on("data", (chunk) => {
            body += chunk.toString();
          });

          res.on("end", () => {
            const duration = Date.now() - startTime;
            if (res.statusCode !== 200) {
              const errMsg = `MCP server returned status code ${res.statusCode}: ${body}`;
              mcpDiagnostics.connectionStatus = "Error";
              mcpDiagnostics.lastError = errMsg;
              return reject(new Error(errMsg));
            }

            try {
              // The response can be in standard JSON-RPC format, or SSE event stream format.
              // FastMCP streamable-http returns:
              // event: message
              // data: {"jsonrpc": "2.0", "id": 1, "result": ...}
              const lines = body.split("\n");
              for (const line of lines) {
                if (line.startsWith("data:")) {
                  const dataContent = line.substring(5).trim();
                  const parsed = JSON.parse(dataContent);
                  
                  if (parsed.error) {
                    return reject(new Error(parsed.error.message || JSON.stringify(parsed.error)));
                  }
                  return resolve(parsed.result);
                }
              }

              // Fallback to raw JSON if not SSE formatted
              const parsed = JSON.parse(body);
              if (parsed.error) {
                return reject(new Error(parsed.error.message || JSON.stringify(parsed.error)));
              }
              return resolve(parsed.result);
            } catch (e: any) {
              const errMsg = `Failed to parse response: ${e.message}. Body: ${body}`;
              mcpDiagnostics.connectionStatus = "Error";
              mcpDiagnostics.lastError = errMsg;
              reject(new Error(errMsg));
            }
          });
        }
      );

      req.on("error", (err) => {
        mcpDiagnostics.connectionStatus = "Error";
        mcpDiagnostics.lastError = err.message;
        reject(err);
      });

      req.on("timeout", () => {
        req.destroy();
        reject(new Error("Request timed out"));
      });

      req.write(data);
      req.end();
    });
  }

  public async listTools(): Promise<McpTool[]> {
    const startTime = Date.now();
    try {
      const response = await this.postMcpRequest("tools/list");
      mcpDiagnostics.connectionStatus = "Connected";
      
      const durationMs = Date.now() - startTime;
      // Log diagnostics log
      mcpDiagnostics.logExecution({
        timestamp: new Date().toISOString(),
        toolName: "listTools",
        status: "success",
        durationMs,
        inputArguments: {}
      });

      return response.tools || [];
    } catch (err: any) {
      mcpDiagnostics.connectionStatus = "Error";
      mcpDiagnostics.logExecution({
        timestamp: new Date().toISOString(),
        toolName: "listTools",
        status: "error",
        durationMs: Date.now() - startTime,
        error: err.message,
        inputArguments: {}
      });
      throw err;
    }
  }

  public async callTool(name: string, args: Record<string, any> = {}): Promise<any> {
    const startTime = Date.now();
    try {
      const response = await this.postMcpRequest("tools/call", {
        name,
        arguments: args
      });
      mcpDiagnostics.connectionStatus = "Connected";

      // Automatically unwrap and parse stringified JSON inside MCP text blocks
      const unpacked = extractResultData(response);

      const durationMs = Date.now() - startTime;
      mcpDiagnostics.logExecution({
        timestamp: new Date().toISOString(),
        toolName: name,
        status: "success",
        durationMs,
        inputArguments: args
      });

      return unpacked;
    } catch (err: any) {
      mcpDiagnostics.logExecution({
        timestamp: new Date().toISOString(),
        toolName: name,
        status: "error",
        durationMs: Date.now() - startTime,
        error: err.message,
        inputArguments: args
      });
      throw err;
    }
  }
}

function parsePythonDict(str: string): any {
  try {
    return new Function(`return (${str})`)();
  } catch {
    try {
      return JSON.parse(str.replace(/'/g, '"'));
    } catch {
      return str;
    }
  }
}

function parseNestedStrings(obj: any): any {
  if (!obj || typeof obj !== "object") return obj;

  // If it is an array
  if (Array.isArray(obj)) {
    return obj.map(item => {
      if (typeof item === "string" && item.trim().startsWith("{") && item.trim().endsWith("}")) {
        return parseNestedStrings(parsePythonDict(item));
      }
      return parseNestedStrings(item);
    });
  }

  // If it is an object
  const newObj: any = {};
  for (const [key, val] of Object.entries(obj)) {
    if (typeof val === "string" && val.trim().startsWith("{") && val.trim().endsWith("}")) {
      newObj[key] = parseNestedStrings(parsePythonDict(val));
    } else {
      newObj[key] = parseNestedStrings(val);
    }
  }
  return newObj;
}

function extractResultData(result: any): any {
  if (!result) return result;
  if (result.structuredContent !== undefined) return result.structuredContent;

  const blocks = result.content ?? [];
  const textBlocks = blocks.filter((b: any) => b.type === "text" && typeof b.text === "string");

  let dataObj = result;
  if (textBlocks.length === 1) {
    dataObj = tryParseJson(textBlocks[0].text);
  } else if (textBlocks.length > 1) {
    dataObj = textBlocks.map((b: any) => tryParseJson(b.text));
  }

  // Clean and parse single-quoted python dictionaries returned from CRM endpoints
  return parseNestedStrings(dataObj);
}

function tryParseJson(text: string): any {
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}
