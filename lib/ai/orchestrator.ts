import OpenAI from "openai";
import Anthropic from "@anthropic-ai/sdk";
import { McpClient, McpTool, mcpDiagnostics } from "../mcp/client";
import { CRM_AGENT_SYSTEM_PROMPT_CORPORATE, CRM_AGENT_SYSTEM_PROMPT_RETAIL } from "./prompts";
import { AIWorkspaceResponse, AIWorkspaceResponseSchema, UI_COMPONENT_TYPES } from "./ui-schema";
import { auditLogger } from "../security/audit";

// MCP tools whose results represent a single CRM entity (customer/account/lead) worth
// remembering for the rest of the conversation, so follow-up questions don't need to
// re-hit the MCP server for data we already have.
const FETCH_TOOL_NAMES = new Set(["get_account", "get_retail_account", "get_retail_lead"]);

interface CachedEntity {
  toolName: string;
  args: Record<string, any>;
  rawResult: any;
  fetchedAt: number;
}

// Anthropic tool definition used to force Claude to hand back a structured
// AIWorkspaceResponse instead of free-form text (Claude has no "json_object" response
// mode like OpenAI, so a forced tool call is the reliable way to get validated JSON out).
const RENDER_UI_TOOL: Anthropic.Tool = {
  name: "render_workspace_ui",
  description:
    "Render the final BUSINESSNEXT workspace UI for this turn. Call this exactly once, after any needed CRM data has been gathered, with your freshly-designed component layout.",
  input_schema: {
    type: "object",
    properties: {
      title: { type: "string" },
      subtitle: { type: "string" },
      message: { type: "string", description: "Conversational summary shown above the rendered components." },
      layout: {
        type: "object",
        properties: {
          type: { type: "string", enum: ["dashboard", "detail", "list", "workspace"] },
          columns: { type: "number" },
        },
      },
      components: {
        type: "array",
        items: {
          type: "object",
          properties: {
            type: { type: "string", enum: [...UI_COMPONENT_TYPES] },
            title: { type: "string" },
            subtitle: { type: "string" },
            data: {},
            props: { type: "object" },
          },
          required: ["type"],
        },
      },
      suggestedActions: {
        type: "array",
        items: {
          type: "object",
          properties: {
            id: { type: "string" },
            label: { type: "string" },
            intent: { type: "string" },
            requiresConfirmation: { type: "boolean" },
            actionCategory: { type: "string", enum: ["READ", "WRITE", "DESTRUCTIVE"] },
            payload: { type: "object" },
          },
          required: ["id", "label", "intent"],
        },
      },
    },
    required: ["components"],
  },
};

export class AIOrchestrator {
  private openai: OpenAI | null = null;
  private anthropic: Anthropic | null = null;
  private mcpClient: McpClient;

  // In-memory, per-conversation cache of raw CRM entity fetches. Lives for the lifetime
  // of this server instance (same pattern as auditLogger / mcpDiagnostics elsewhere in
  // this codebase) so a follow-up turn can reuse already-fetched data instead of calling
  // the MCP server again.
  private entityCache: Map<string, CachedEntity[]> = new Map();

  constructor() {
    this.mcpClient = new McpClient();

    const anthropicKey = process.env.ANTHROPIC_API_KEY;
    if (anthropicKey) {
      this.anthropic = new Anthropic({ apiKey: anthropicKey });
    }

    const openaiKey = process.env.OPENAI_API_KEY;
    if (openaiKey) {
      this.openai = new OpenAI({ apiKey: openaiKey });
    }

    if (!this.anthropic && !this.openai) {
      console.warn("[ORCHESTRATOR] No ANTHROPIC_API_KEY or OPENAI_API_KEY defined. Falling back to local semantic parser.");
    }
  }

  private cacheEntity(conversationId: string, toolName: string, args: Record<string, any>, rawResult: any) {
    if (!FETCH_TOOL_NAMES.has(toolName)) return;
    const list = this.entityCache.get(conversationId) || [];
    const key = `${toolName}:${JSON.stringify(args)}`;
    const withoutStale = list.filter((e) => `${e.toolName}:${JSON.stringify(e.args)}` !== key);
    withoutStale.push({ toolName, args, rawResult, fetchedAt: Date.now() });
    // Cap history so the context block doesn't grow unbounded over a long conversation.
    this.entityCache.set(conversationId, withoutStale.slice(-5));
  }

  private getCachedContextBlock(conversationId: string): string {
    const list = this.entityCache.get(conversationId);
    if (!list || list.length === 0) return "";
    const serialized = list.map((e) => ({ tool: e.toolName, arguments: e.args, data: e.rawResult }));
    return `\n\n### CACHED CRM CONTEXT (already fetched this conversation)\n${JSON.stringify(serialized)}`;
  }

  // Pulls a real name/phone out of the most recently fetched CRM entity for this
  // conversation, so "create a lead for that customer" reuses the actual record instead
  // of falling back to a hardcoded demo name.
  private getLastCachedContact(conversationId: string): { name: string; lastName: string; phone?: string } | null {
    const list = this.entityCache.get(conversationId);
    if (!list || list.length === 0) return null;
    const entity = list[list.length - 1];
    const raw = entity.rawResult;

    let data: any;
    if (entity.toolName === "get_retail_lead") {
      data = raw?.lead?.result?.[0] || raw?.lead || raw;
    } else {
      data = raw?.account?.result?.[0] || raw?.account || raw;
    }

    const fullName = data?.name || data?.Name || data?.["Lead Name"];
    if (!fullName) return null;

    const parts = String(fullName).trim().split(/\s+/);
    const phone = data?.["Mobile Phone"] || data?.phone || data?.Phone;

    return {
      name: parts[0],
      lastName: parts.slice(1).join(" ") || parts[0],
      phone: phone !== undefined && phone !== null ? String(phone) : undefined,
    };
  }

  // Reads the product the user actually asked for out of the message text, instead of
  // always defaulting to a generic loan product regardless of what was requested.
  private detectRequestedProduct(message: string, mode: "corporate" | "retail"): string {
    const m = message.toLowerCase();
    if (m.includes("credit card")) return "Credit Card";
    if (m.includes("home loan") || m.includes("mortgage")) return "Home Loan";
    if (m.includes("auto loan") || m.includes("car loan") || m.includes("vehicle loan")) return "Auto Loan";
    if (m.includes("savings account") || m.includes("savings")) return "Savings Account";
    if (m.includes("current account") || m.includes("checking account")) return "Current Account";
    if (m.includes("demat")) return "Demat Account";
    if (m.includes("insurance")) return "Insurance";
    if (m.includes("sme financing") || m.includes("business loan") || m.includes("corporate financing")) return "Corporate SME Financing";
    if (m.includes("personal loan")) return mode === "retail" ? "Personal Loan" : "Personal Loan for Salaried Customers";
    return mode === "retail" ? "Home Loan" : "Personal Loan for Salaried Customers";
  }

  private filterCrmTools(mcpTools: McpTool[], mode: "corporate" | "retail"): McpTool[] {
    return mcpTools.filter((t) => {
      if (mode === "retail") {
        return t.name === "get_retail_account" || t.name === "get_retail_lead" || t.name === "create_lead" || t.name === "test_connection";
      }
      return t.name === "get_account" || t.name === "create_lead" || t.name === "test_connection";
    });
  }

  public async processMessage(
    userMessage: string,
    conversationId: string,
    mode: "corporate" | "retail" = "corporate",
    history: any[] = []
  ): Promise<AIWorkspaceResponse> {
    const startTime = Date.now();
    const basePrompt = mode === "retail" ? CRM_AGENT_SYSTEM_PROMPT_RETAIL : CRM_AGENT_SYSTEM_PROMPT_CORPORATE;
    const systemPrompt = basePrompt + this.getCachedContextBlock(conversationId);

    console.log(`[ORCHESTRATOR] Mode: ${mode} | History Turns: ${history.length} | Message: "${userMessage}"`);

    if (this.anthropic) {
      try {
        return await this.processWithAnthropic(userMessage, conversationId, mode, history, systemPrompt, startTime);
      } catch (err: any) {
        console.error("[ORCHESTRATOR] Anthropic agent loop failed, falling back.", err.message);
      }
    }

    if (this.openai) {
      try {
        return await this.processWithOpenAI(userMessage, conversationId, mode, history, systemPrompt, startTime);
      } catch (err: any) {
        console.error("[ORCHESTRATOR] OpenAI agent loop failed, falling back to semantic parser.", err.message);
      }
    }

    // Local Semantic Parser Fallback (interacts with the LIVE MCP server)
    return this.fallbackSemanticRouting(userMessage, conversationId, startTime, mode, history);
  }

  private async processWithAnthropic(
    userMessage: string,
    conversationId: string,
    mode: "corporate" | "retail",
    history: any[],
    systemPrompt: string,
    startTime: number
  ): Promise<AIWorkspaceResponse> {
    const anthropic = this.anthropic!;
    const model = process.env.ANTHROPIC_MODEL || "claude-sonnet-5";
    const toolsUsed: string[] = [];

    const mcpTools = await this.mcpClient.listTools();
    const crmTools = this.filterCrmTools(mcpTools, mode).map((t) => ({
      name: t.name,
      description: t.description || "",
      input_schema: {
        type: "object" as const,
        properties: t.inputSchema.properties,
        required: t.inputSchema.required,
      },
    }));

    const messages: Anthropic.MessageParam[] = [];
    if (Array.isArray(history)) {
      for (const msg of history) {
        messages.push({
          role: msg.role === "assistant" ? "assistant" : "user",
          content: String(msg.content ?? ""),
        });
      }
    }
    messages.push({ role: "user", content: userMessage });

    // Pass 1: let Claude decide whether it needs to call a CRM tool, or already has
    // enough (from the cached context / conversation) to answer directly.
    const pass1 = await anthropic.messages.create({
      model,
      system: systemPrompt,
      max_tokens: 1024,
      temperature: 0.2,
      messages,
      tools: crmTools.length > 0 ? crmTools : undefined,
    });

    messages.push({ role: "assistant", content: pass1.content });

    const toolUseBlocks = pass1.content.filter((b): b is Anthropic.ToolUseBlock => b.type === "tool_use");
    if (toolUseBlocks.length > 0) {
      const toolResultBlocks: Anthropic.ToolResultBlockParam[] = [];

      for (const block of toolUseBlocks) {
        const toolName = block.name;
        const toolArgs = (block.input || {}) as Record<string, any>;
        console.log(`[ORCHESTRATOR] Claude requested tool ${toolName}`, toolArgs);

        const toolStart = Date.now();
        toolsUsed.push(toolName);

        try {
          const result = await this.mcpClient.callTool(toolName, toolArgs);
          this.cacheEntity(conversationId, toolName, toolArgs, result);

          auditLogger.log({
            conversationId,
            userId: "admin-dev",
            toolName,
            actionCategory: toolName === "create_lead" ? "WRITE" : "READ",
            status: "success",
            durationMs: Date.now() - toolStart,
          });

          toolResultBlocks.push({ type: "tool_result", tool_use_id: block.id, content: JSON.stringify(result) });
        } catch (err: any) {
          console.error(`[ORCHESTRATOR] Tool execution error: ${toolName}`, err.message);

          auditLogger.log({
            conversationId,
            userId: "admin-dev",
            toolName,
            actionCategory: toolName === "create_lead" ? "WRITE" : "READ",
            status: "error",
            durationMs: Date.now() - toolStart,
            message: err.message,
          });

          toolResultBlocks.push({
            type: "tool_result",
            tool_use_id: block.id,
            content: JSON.stringify({ error: err.message, status: "error" }),
            is_error: true,
          });
        }
      }

      messages.push({ role: "user", content: toolResultBlocks });
    }

    // Pass 2: force the structured render_workspace_ui tool call so we always get
    // validated JSON back, whether or not a CRM tool was needed this turn.
    const pass2 = await anthropic.messages.create({
      model,
      system: systemPrompt,
      max_tokens: 4096,
      temperature: 0.2,
      messages,
      tools: [RENDER_UI_TOOL],
      tool_choice: { type: "tool", name: "render_workspace_ui" },
    });

    const renderBlock = pass2.content.find(
      (b): b is Anthropic.ToolUseBlock => b.type === "tool_use" && b.name === "render_workspace_ui"
    );
    if (!renderBlock) {
      throw new Error("Claude did not return a render_workspace_ui tool call");
    }

    const validated = AIWorkspaceResponseSchema.parse(renderBlock.input);
    validated.metadata = {
      toolsUsed,
      executionTime: Date.now() - startTime,
    };
    return validated;
  }

  private async processWithOpenAI(
    userMessage: string,
    conversationId: string,
    mode: "corporate" | "retail",
    history: any[],
    systemPrompt: string,
    startTime: number
  ): Promise<AIWorkspaceResponse> {
    const openai = this.openai!;
    const model = process.env.OPENAI_MODEL || "gpt-5.6-terra";
    const toolsUsed: string[] = [];

    // 1. Discover tools from MCP server
    const mcpTools = await this.mcpClient.listTools();

    // 2. Filter tools based on active workspace mode
    const filteredMcpTools = this.filterCrmTools(mcpTools, mode);

    const openaiTools = filteredMcpTools.map((t) => ({
      type: "function" as const,
      function: {
        name: t.name,
        description: t.description || "",
        parameters: {
          type: t.inputSchema.type,
          properties: t.inputSchema.properties,
          required: t.inputSchema.required,
        },
      },
    }));

    const messages: any[] = [{ role: "system", content: systemPrompt }];

    // 3. Append history logs
    if (Array.isArray(history)) {
      for (const msg of history) {
        messages.push({
          role: msg.role === "assistant" ? "assistant" : "user",
          content: msg.content,
        });
      }
    }

    // Append current query
    messages.push({ role: "user", content: userMessage });

    // 4. First completion pass (with tool definitions)
    const response = await openai.chat.completions.create({
      model: model.includes("gpt-5.6") ? "gpt-4o" : model,
      messages,
      tools: openaiTools.length > 0 ? openaiTools : undefined,
      temperature: 0.2,
    });

    const choice = response.choices[0];
    const messageResponse = choice?.message;

    // 5. Check for tool executions requested by the AI
    if (messageResponse?.tool_calls && messageResponse.tool_calls.length > 0) {
      console.log(`[ORCHESTRATOR] OpenAI requested ${messageResponse.tool_calls.length} tool call(s).`);
      messages.push(messageResponse);

      for (const toolCall of messageResponse.tool_calls as any[]) {
        const toolName = toolCall.function.name;
        const toolArgs = JSON.parse(toolCall.function.arguments || "{}");
        console.log(`[ORCHESTRATOR] Executing tool ${toolName} in real-time...`, toolArgs);

        const toolStart = Date.now();
        toolsUsed.push(toolName);
        let resultText = "";

        try {
          const result = await this.mcpClient.callTool(toolName, toolArgs);
          this.cacheEntity(conversationId, toolName, toolArgs, result);
          resultText = JSON.stringify(result);

          auditLogger.log({
            conversationId,
            userId: "admin-dev",
            toolName,
            actionCategory: toolName === "create_lead" ? "WRITE" : "READ",
            status: "success",
            durationMs: Date.now() - toolStart,
          });
        } catch (err: any) {
          console.error(`[ORCHESTRATOR] Real-time tool execution error: ${toolName}`, err.message);
          resultText = JSON.stringify({ error: err.message, status: "error" });

          auditLogger.log({
            conversationId,
            userId: "admin-dev",
            toolName,
            actionCategory: toolName === "create_lead" ? "WRITE" : "READ",
            status: "error",
            durationMs: Date.now() - toolStart,
            message: err.message,
          });
        }

        messages.push({
          role: "tool",
          tool_call_id: toolCall.id,
          content: resultText,
        });
      }

      // 6. Second completion pass (returns structured UI schema based on tool results)
      console.log("[ORCHESTRATOR] Calling OpenAI second completion pass...");
      const secondResponse = await openai.chat.completions.create({
        model: model.includes("gpt-5.6") ? "gpt-4o" : model,
        messages,
        temperature: 0.2,
        response_format: { type: "json_object" },
      });

      const content = secondResponse.choices[0]?.message?.content || "";
      const parsed = JSON.parse(content);
      const validated = AIWorkspaceResponseSchema.parse(parsed);

      validated.metadata = {
        toolsUsed,
        executionTime: Date.now() - startTime,
      };

      return validated;
    }

    // Handle direct text/JSON response if no tools were called (e.g. conversational follow-ups)
    const content = messageResponse?.content || "";
    const parsed = JSON.parse(content);
    const validated = AIWorkspaceResponseSchema.parse(parsed);

    validated.metadata = {
      toolsUsed: [],
      executionTime: Date.now() - startTime,
    };

    return validated;
  }

  private async fallbackSemanticRouting(
    message: string,
    conversationId: string,
    startTime: number,
    mode: "corporate" | "retail",
    history: any[] = []
  ): Promise<AIWorkspaceResponse> {
    const lowerMessage = message.toLowerCase();
    const toolsUsed: string[] = [];

    // Helper to log read audit
    const logReadAudit = (toolName: string, duration: number, status: "success" | "error" = "success") => {
      auditLogger.log({
        conversationId,
        userId: "admin-dev",
        toolName,
        actionCategory: "READ",
        status,
        durationMs: duration,
      });
    };

    // Parse history to check if we just retrieved a Customer 360 or Lead Profile
    let lastRetrievedCustomer: string | null = null;
    let lastRetrievedLead: string | null = null;

    if (Array.isArray(history)) {
      for (let i = history.length - 1; i >= 0; i--) {
        const msg = history[i];
        if (msg.role === "assistant") {
          try {
            const parsed = JSON.parse(msg.content);
            if (parsed.title?.includes("Customer 360") || parsed.title?.includes("Customer Profile")) {
              lastRetrievedCustomer = parsed.title;
            }
            if (parsed.title?.includes("Lead Profile") || parsed.title?.includes("Lead Creation")) {
              lastRetrievedLead = parsed.title;
            }
          } catch (e) {
            // Not JSON
          }
        }
      }
    }

    // A. CONVERSATIONAL CONTEXT CHECK
    // Determine if user is issuing a search or a follow-up
    const hasId = message.match(/\b\d{4,5}\b/);
    const isNewSearch =
      lowerMessage.includes("ryan") ||
      lowerMessage.includes("gates") ||
      lowerMessage.includes("petronas") ||
      lowerMessage.includes("babu") ||
      lowerMessage.includes("thomas") ||
      lowerMessage.includes("hunnu") ||
      lowerMessage.includes("anushka") ||
      lowerMessage.includes("singhania") ||
      lowerMessage.includes("jatin") ||
      lowerMessage.includes("deshmukh") ||
      hasId;

    const isFollowUp = (lastRetrievedCustomer || lastRetrievedLead) && !isNewSearch;

    if (isFollowUp) {
      console.log(`[ORCHESTRATOR] Conversational follow-up query matched. Context: Customer=${lastRetrievedCustomer}, Lead=${lastRetrievedLead}`);

      let replyMessage = "I have reviewed our conversation context. ";
      let cardTitle = "Conversational CRM Answer";
      let summaryData: any = {};
      let customLayout: { type: "dashboard" | "detail" | "list" | "workspace"; columns: number } = { type: "dashboard", columns: 1 };
      let customComponents: any[] = [];

      // Check if user is requesting to change layout/UI
      const isLayoutChangeRequest =
        lowerMessage.includes("layout") ||
        lowerMessage.includes("ui") ||
        lowerMessage.includes("column") ||
        lowerMessage.includes("view") ||
        lowerMessage.includes("change") ||
        lowerMessage.includes("different") ||
        lowerMessage.includes("grid") ||
        lowerMessage.includes("rearrange") ||
        lowerMessage.includes("horizontal") ||
        lowerMessage.includes("vertical");

      if (lastRetrievedCustomer) {
        const isRetail = lastRetrievedCustomer.includes("Retail");
        const clientName = lastRetrievedCustomer.replace(" - Retail Customer Profile", "").replace(" - Corporate Customer 360", "");

        if (isLayoutChangeRequest) {
          // Re-render the customer profile but in a single detailed column
          replyMessage = `I have reorganized the UI layout for ${clientName}'s Customer 360 into a consolidated single-column view.`;
          cardTitle = `${clientName} - Modified Layout`;
          customLayout = { type: "detail", columns: 1 };

          if (isRetail) {
            customComponents = [
              {
                type: "page_header",
                title: clientName,
                subtitle: `Banking Segment: Retail  ·  Account Number: 2571  ·  Assigned To: Mr. Ranjan Sharma`
              },
              {
                type: "metric_group",
                title: "Retail KPIs (Consolidated)",
                data: [
                  { label: "Tier", value: "Gold" },
                  { label: "Employment", value: "Salaried" },
                  { label: "CLTV (Lifetime Value)", value: "262.5" },
                  { label: "Churn Propensity", value: "Likely to Churn" },
                  { label: "Next Best Offer", value: "Pre-approved Top Up!" }
                ]
              },
              {
                type: "account_summary",
                title: "PERSONAL & CONTACT DETAILS",
                data: {
                  "Mobile Phone": "9971600404",
                  "Email Address": "nikhil.ravi@businessnext.com",
                  "Billing Address": "Mahalakshmi, Mumbai, India"
                }
              },
              {
                type: "key_value_grid",
                title: "PRODUCT INTERESTS & HOLDINGS",
                data: [
                  { key: "Products Held", value: "Demat Account, Savings" },
                  { key: "Eligible Card Offerings", value: "Exclusive Signature Card" },
                  { key: "Services Active", value: "Mobile Banking, Debit Card" }
                ]
              }
            ];
          } else {
            customComponents = [
              {
                type: "page_header",
                title: clientName,
                subtitle: `Active CRM Profile • Segment: Platinum • RM: Mr. Shaukat Ahmad`
              },
              {
                type: "metric_group",
                title: "Corporate Metrics (Consolidated)",
                data: [
                  { label: "Employees", value: ">10,000" },
                  { label: "Rating", value: "4.0 / 5.0" },
                  { label: "Moody's Rating", value: "A1" }
                ]
              },
              {
                type: "account_summary",
                title: "CONTACT DETAILS",
                data: {
                  "Phone": "03-7982-9186",
                  "Email": "info@petronas.com"
                }
              }
            ];
          }
        }
        // Handle other details follow-ups
        else if (lowerMessage.includes("rm") || lowerMessage.includes("manager") || lowerMessage.includes("assigned")) {
          const rm = isRetail ? "Mr. Ranjan Sharma" : "Mr. Shaukat Ahmad";
          replyMessage += `The Relationship Manager assigned to ${clientName} is ${rm}.`;
          cardTitle = "Relationship Manager";
          summaryData = { "Assigned RM": rm, "Customer Profile": clientName, "Contact Channel": "Email/Phone" };
        } else if (lowerMessage.includes("email")) {
          const email = isRetail ? "nikhil.ravi@businessnext.com" : "info@petronas.com";
          replyMessage += `The registered email on record for ${clientName} is ${email}.`;
          cardTitle = "Contact Email";
          summaryData = { "Registered Email": email, "Customer": clientName };
        } else if (lowerMessage.includes("phone") || lowerMessage.includes("mobile")) {
          const phone = isRetail ? "9971600404" : "03-7982-9186";
          replyMessage += `The phone number for ${clientName} is ${phone}.`;
          cardTitle = "Contact Phone";
          summaryData = { "Mobile Phone": phone, "Customer": clientName };
        } else if (lowerMessage.includes("cltv") || lowerMessage.includes("value")) {
          replyMessage += `The Customer Lifetime Value (CLTV) for ${clientName} is assessed as 262.5 (Tier: Gold).`;
          cardTitle = "CLTV Details";
          summaryData = { "CLTV Value": "262.5", "Customer Tier": "Gold", "Trend": "Stable" };
        } else if (lowerMessage.includes("rating")) {
          const ratingInfo = isRetail ? "Hot (Retail CRM Rating)" : "A1 (Moody's) / LAAA (ICRA)";
          replyMessage += `The credit and importance rating on file for ${clientName} is ${ratingInfo}.`;
          cardTitle = "Customer Ratings";
          summaryData = { "Credit Rating": ratingInfo, "Customer": clientName };
        } else if (lowerMessage.includes("offer") || lowerMessage.includes("nbo")) {
          const offer = isRetail ? "Pre-approved Top Up! (Exclusive Credit Card offer)" : "Corporate SME Expansion Financing";
          replyMessage += `The Next Best Offer for ${clientName} is ${offer}.`;
          cardTitle = "Next Best Offer";
          summaryData = { "Next Best Offer": offer, "Target Customer": clientName };
        } else if (lowerMessage.includes("strengths") || lowerMessage.includes("weakness")) {
          replyMessage += isRetail
            ? `Ryan Gates shows strong HNWI Segment tags. Churn propensity is flagged as high, recommended for Top-Up offer.`
            : `Petronas Malaysia strengths include strong brand presence and versatile manufacturing capacity, balanced against historical labor strikes.`;
          cardTitle = "Business Profile Insights";
          summaryData = { "Core Strengths": isRetail ? "HNWI Portfolio" : "Global Brand Image", "Weaknesses": isRetail ? "Churn Propensity" : "Labour strikes history" };
        } else {
          replyMessage += `Here are the key profile details for ${clientName}. Please specify if you need the RM, CLTV, or contact information.`;
          cardTitle = `${clientName} Quick Facts`;
          summaryData = { "RM Owner": isRetail ? "Mr. Ranjan Sharma" : "Mr. Shaukat Ahmad", "Banking Segment": isRetail ? "Retail" : "Corporate" };
        }
      } else if (lastRetrievedLead) {
        const leadName = lastRetrievedLead.replace(" - Retail Lead Profile", "");

        if (isLayoutChangeRequest) {
          replyMessage = `I have reorganized the UI layout for lead ${leadName} into a detailed vertical flow.`;
          cardTitle = `${leadName} - Modified Layout`;
          customLayout = { type: "detail", columns: 1 };
          customComponents = [
            {
              type: "page_header",
              title: leadName,
              subtitle: `Product Interest: Home Loan  ·  Status: Finance Disbursed  ·  Lead ID: 13314`
            },
            {
              type: "metric_group",
              title: "Lead Parameters (Consolidated)",
              data: [
                { label: "Applicant", value: "Individual" },
                { label: "Purpose", value: "Home Acquire" },
                { label: "Risk Rating", value: "Risk Free" }
              ]
            }
          ];
        } else if (lowerMessage.includes("owner") || lowerMessage.includes("assigned")) {
          replyMessage += `The Lead Owner assigned to this record is Mr. James May.`;
          cardTitle = "Lead Assignment";
          summaryData = { "Lead Owner": "Mr. James May", "Record Target": leadName };
        } else if (lowerMessage.includes("purpose") || lowerMessage.includes("financing") || lowerMessage.includes("buy")) {
          replyMessage += `The financing purpose on record is Home Acquire for a Condominium Acquisition.`;
          cardTitle = "Financing Details";
          summaryData = { "Purpose": "Home Acquire", "Property Type": "Apartment", "Classification": "Residential" };
        } else if (lowerMessage.includes("risk") || lowerMessage.includes("free")) {
          replyMessage += `The lead risk classification is assessed as Risk Free.`;
          cardTitle = "Risk Evaluation";
          summaryData = { "Risk Tier": "Risk Free", "Lead Number": "13314" };
        } else if (lowerMessage.includes("phone") || lowerMessage.includes("mobile")) {
          replyMessage += `The contact phone number is 9999927066.`;
          cardTitle = "Lead Mobile";
          summaryData = { "Mobile Phone": "9999927066", "Applicant": leadName };
        } else {
          replyMessage += `Here is the summary of the retail lead Anushka Ajay Singhania for a Home Loan. Status code: Finance Disbursed.`;
          cardTitle = "Lead Summary";
          summaryData = { "Product": "Home Loan", "Status": "Finance Disbursed", "Owner": "Mr. James May" };
        }
      }

      return {
        version: "1.0",
        title: cardTitle,
        subtitle: "Conversational Query Resolved",
        message: replyMessage,
        layout: customLayout,
        components: customComponents.length > 0 ? customComponents : [
          {
            type: "account_summary",
            title: "CRM Detail Lookup",
            data: summaryData
          }
        ],
        metadata: {
          toolsUsed: [],
          executionTime: Date.now() - startTime
        }
      };
    }

    // 1. DIAGNOSTICS: Test Connection (Common)
    if (lowerMessage.includes("test connection") || lowerMessage.includes("mcp status") || lowerMessage.includes("mcp diagnostics")) {
      const toolStart = Date.now();
      toolsUsed.push("test_connection");
      try {
        const results = await this.mcpClient.callTool("test_connection", {});
        logReadAudit("test_connection", Date.now() - toolStart);

        return {
          version: "1.0",
          title: "CRM Diagnostics Check",
          subtitle: "MCP Connection Integrity Test",
          message: "All backend services are operating within normal latencies. Authorization token has been refreshed successfully.",
          layout: { type: "workspace", columns: 1 },
          components: [
            {
              type: "alert",
              title: "System Status: Connected",
              props: { type: "success" },
              data: {
                message: `Connection successfully established with fast response from CRM database servers. Discovered MCP tools list loaded.`
              }
            },
            {
              type: "account_summary",
              title: "Diagnostics Log",
              data: {
                "Gold8 Auth Status": results.gold8_auth || "N/A",
                "GTS Auth Status": results.gts_auth || "N/A",
                "Gold8 testapi Endpoint": results.gold8_testapi || "N/A",
                "MCP Target Server URL": process.env.CRM_MCP_SERVER_URL || "https://headlessmcp.vercel.app/mcp",
              }
            }
          ],
          metadata: {
            toolsUsed,
            executionTime: Date.now() - startTime
          }
        };
      } catch (err: any) {
        logReadAudit("test_connection", Date.now() - toolStart, "error");
        return this.errorResponse(err.message, toolsUsed, startTime);
      }
    }

    // 2. LEAD CREATION INTENT (Common to both modes)
    if (lowerMessage.includes("create") || lowerMessage.includes("save") || (lowerMessage.includes("lead") && !lowerMessage.includes("show") && !lowerMessage.includes("find") && !lowerMessage.includes("get") && !message.match(/\b\d{5}\b/))) {
      // Explicit "lead for First Last" always wins. Otherwise, if the message references
      // an already-established entity ("that customer", "them", or just no name at all),
      // reuse the real record from this conversation's cache instead of a demo placeholder.
      // A pronoun/placeholder stoplist keeps "lead for that customer" from being
      // misread as a literal first/last name ("That Customer").
      const PRONOUN_STOPLIST = new Set(["that", "this", "them", "him", "her", "the", "same", "said", "customer", "client", "account", "lead"]);
      const rawNameMatch = message.match(/lead (?:for|called) ([A-Za-z]+)\s*([A-Za-z]*)/i) || [];
      const isRealName = !!rawNameMatch[1] && !PRONOUN_STOPLIST.has(rawNameMatch[1].toLowerCase());
      const cachedContact = this.getLastCachedContact(conversationId);
      const name = (isRealName && rawNameMatch[1]) || cachedContact?.name || "Anushka";
      const lastName = (isRealName && rawNameMatch[2]) || cachedContact?.lastName || "Singhania";
      const phoneMatch = message.match(/(\d[\d-\s]{7,\d})/);
      // Only reuse the cached phone when we're actually reusing that cached person's name too —
      // an explicit different name shouldn't inherit someone else's phone number.
      const mobilePhone = phoneMatch ? phoneMatch[0].trim() : (!isRealName && cachedContact?.phone) || "9999927066";
      const product = this.detectRequestedProduct(message, mode);

      return {
        version: "1.0",
        title: mode === "retail" ? "Confirm Retail Lead Creation" : "Confirm Corporate Lead Creation",
        subtitle: "Authorize CRM Write Action",
        message: "You have requested to create a new Lead in the CRM. Please review the details below before authorizing execution.",
        layout: { type: "detail", columns: 1 },
        components: [
          {
            type: "confirmation",
            title: "Authorize Lead Creation?",
            data: {
              targetTool: "create_lead",
              arguments: {
                name,
                last_name: lastName,
                mobile_phone: mobilePhone,
                product,
                product_category: "Loans",
                lead_owner_name: "Mr. James May",
                rating: "Warm"
              }
            }
          }
        ],
        suggestedActions: [
          {
            id: "confirm_create_lead",
            label: "Authorize & Create Lead",
            intent: `Create lead for ${name} ${lastName}`,
            requiresConfirmation: true,
            actionCategory: "WRITE",
            payload: {
              name,
              last_name: lastName,
              mobile_phone: mobilePhone
            }
          }
        ],
        metadata: {
          toolsUsed,
          executionTime: Date.now() - startTime
        }
      };
    }

    // 3. RETAIL WORKSPACE ROUTING
    if (mode === "retail") {
      // INTENT R.1: Retail Lead Lookup (e.g. "lead 13314", "Anushka Singhania")
      if (lowerMessage.includes("13314") || lowerMessage.includes("anushka") || lowerMessage.includes("singhania") || message.match(/\b\d{5}\b/) || (lowerMessage.includes("lead") && (lowerMessage.includes("show") || lowerMessage.includes("find") || lowerMessage.includes("get")))) {
        const toolStart = Date.now();
        toolsUsed.push("get_retail_lead");
        try {
          const leadMatch = message.match(/\b\d{5}\b/);
          const leadId = leadMatch ? leadMatch[0] : "13314";
          const args = { lead_id: leadId };
          const result = await this.mcpClient.callTool("get_retail_lead", args);
          this.cacheEntity(conversationId, "get_retail_lead", args, result);
          logReadAudit("get_retail_lead", Date.now() - toolStart);

          const leadData = result.lead?.result?.[0] || result.lead || result;
          const leadName = leadData["Lead Name"] || "Anushka Ajay Singhania";
          const leadOwner = leadData["Lead Owner"] || "Mr. James May";
          const product = leadData.product || "Home Loan";
          const status = leadData["Status Code"] || "Finance Disbursed";

          return {
            version: "1.0",
            title: `${leadName} - Retail Lead Profile`,
            subtitle: `Product: ${product} | Status: ${status} | Lead ID: ${leadId}`,
            message: `Retrieved Retail Lead details for ${leadName} successfully.`,
            layout: { type: "workspace", columns: 2 },
            components: [
              {
                type: "page_header",
                title: leadName,
                subtitle: `Product Interest: ${product}  ·  Status: ${status}  ·  Lead ID: ${leadId}`
              },
              {
                type: "metric_group",
                title: "Lead Parameters",
                data: [
                  { label: "Applicant", value: leadData["Applicant Type"] || "Individual" },
                  { label: "Financing Purpose", value: leadData["Financing Purpose"] || "Home Acquire" },
                  { label: "Risk Rating", value: leadData["Risk Classification"] || "Risk Free" },
                  { label: "Property Type", value: leadData["Property Type"] || "Apartment" },
                  { label: "Property Class", value: leadData["Property Classification"] || "Residential" }
                ]
              },
              {
                type: "account_summary",
                title: "LEAD CONTACT DETAILS",
                data: {
                  "Mobile Phone": leadData["Mobile Phone"] || "9999927066",
                  "Email Address": leadData.email || "anushka.s@gmail.com",
                  "Acquisition Purpose": leadData["Acquisition Purpose"] || "Condominium Acquisition",
                  "Address": leadData.address || "14th Floor, Empire Tower Chennai",
                  "Campaign Ref": leadData.Campaign || "Home Loan Offer @7.25%",
                  "Lead Assigned Owner": leadOwner
                }
              },
              {
                type: "key_value_grid",
                title: "LEAD REMARKS & NOTES",
                data: [
                  { key: "Lead Activity Comments", value: leadData.comments || "Documents collected" },
                  { key: "Preferred Communication Channel", value: leadData["Preferred Channel"] || "Email" }
                ]
              }
            ],
            metadata: {
              toolsUsed,
              executionTime: Date.now() - startTime
            }
          };
        } catch (err: any) {
          logReadAudit("get_retail_lead", Date.now() - toolStart, "error");
          return this.errorResponse(err.message, toolsUsed, startTime);
        }
      }

      // INTENT R.2: Retail Customer Lookup (e.g. "customer 2356", "Ryan Gates", "gates", "jatin")
      // Only execute if it matches customer keyword or name or id
      const isCustomerSearch =
        lowerMessage.includes("ryan") ||
        lowerMessage.includes("gates") ||
        lowerMessage.includes("customer") ||
        lowerMessage.includes("account") ||
        lowerMessage.includes("cif") ||
        lowerMessage.includes("jatin") ||
        lowerMessage.includes("deshmukh") ||
        lowerMessage.includes("baby") ||
        lowerMessage.includes("kumar") ||
        message.match(/\b\d{4}\b/);

      if (isCustomerSearch) {
        const toolStart = Date.now();
        toolsUsed.push("get_retail_account");
        try {
          const idMatch = message.match(/\b\d{4}\b/);
          const accountId = idMatch ? idMatch[0] : (lowerMessage.includes("jatin") || lowerMessage.includes("deshmukh") ? "2571" : (lowerMessage.includes("baby") || lowerMessage.includes("kumar") ? "2593" : "2356"));
          const args = { account_id: accountId };
          const result = await this.mcpClient.callTool("get_retail_account", args);
          this.cacheEntity(conversationId, "get_retail_account", args, result);
          logReadAudit("get_retail_account", Date.now() - toolStart);

          const accountData = result.account?.result?.[0] || result.account || result;
          const customerName = accountData.name || (lowerMessage.includes("jatin") ? "Jatin Deshmukh" : (lowerMessage.includes("baby") ? "Mr. Baby Kumar" : "Mr. Ryan Gates"));
          const tier = accountData["Customer Tier"] || "Gold";
          const employment = accountData["Employment Type"] || "Salaried";
          const cltvVal = accountData.cltv !== undefined && accountData.cltv !== null ? String(accountData.cltv) : "262.5";
          const churnVal = accountData["Churn Propensity Segment"] || "Likely to Churn";
          const nboVal = accountData["Next Best Offer"] || "Pre-approved Top Up!";
          const phone = accountData["Mobile Phone"] || accountData.phone || "9971600404";
          const email = accountData.email || "nikhil.ravi@businessnext.com";

          return {
            version: "1.0",
            title: `${customerName} - Retail Customer Profile`,
            subtitle: `Tier: ${tier} | Segment: Retail | ID: ${accountId}`,
            message: `Retrieved Retail Customer 360 overview for ${customerName} successfully.`,
            layout: { type: "workspace", columns: 2 },
            components: [
              {
                type: "page_header",
                title: customerName,
                subtitle: `Banking Segment: ${accountData["Banking Segment"] || "Retail"}  ·  Account Number: ${accountId}  ·  Assigned To: ${accountData["Assigned To"] || "Mr. George Thomas"}`
              },
              {
                type: "metric_group",
                title: "Retail KPIs",
                data: [
                  { label: "Customer Tier", value: tier },
                  { label: "Employment", value: employment },
                  { label: "CLTV (Lifetime Value)", value: cltvVal },
                  { label: "Churn Propensity", value: churnVal },
                  { label: "Next Best Offer", value: nboVal }
                ]
              },
              {
                type: "account_summary",
                title: "PERSONAL & CONTACT DETAILS",
                data: {
                  "Mobile Phone": phone,
                  "Email Address": email,
                  "Billing Address": accountData["Billing Address"] || "Mahalakshmi, Mumbai, India",
                  "Billing Location": `${accountData["Billing City"] || "Penhas Road"}, ${accountData["Billing State"] || "Singapore"}`,
                  "Employment Details": `${employment} at ${accountData["Employer Name"] || "Accent Consulting"}`
                }
              },
              {
                type: "key_value_grid",
                title: "PRODUCT INTERESTS & HOLDINGS",
                data: [
                  { key: "Products Held", value: accountData["Product Holdings"] || "Demat Account, Savings" },
                  { key: "Eligible Card Offerings", value: accountData["Eligible / Recommended Card Products"] || "Exclusive Signature Card" },
                  { key: "Services Active", value: accountData["Products & Services Held"] || "Mobile Banking, Debit Card" },
                  { key: "Customer Segmentation Tags", value: accountData["Customer Segmentation Tags"] || "HNWI Segment" }
                ]
              }
            ],
            metadata: {
              toolsUsed,
              executionTime: Date.now() - startTime
            }
          };
        } catch (err: any) {
          logReadAudit("get_retail_account", Date.now() - toolStart, "error");
          return this.errorResponse(err.message, toolsUsed, startTime);
        }
      }
    }

    // 4. CORPORATE WORKSPACE ROUTING (mode === "corporate")
    else {
      // INTENT C.1: Customer search / profile (GTS Corporate Account)
      if (lowerMessage.includes("babu") || lowerMessage.includes("thomas") || lowerMessage.includes("petronas") || lowerMessage.includes("account") || lowerMessage.includes("customer") || lowerMessage.includes("cif") || lowerMessage.includes("hunnu") || message.match(/\b\d{4}\b/)) {
        const toolStart = Date.now();
        toolsUsed.push("get_account");

        try {
          const idMatch = message.match(/\b\d{4}\b/);
          const accountId = idMatch ? idMatch[0] : "2463";
          const args = { account_id: accountId };
          const result = await this.mcpClient.callTool("get_account", args);
          this.cacheEntity(conversationId, "get_account", args, result);
          logReadAudit("get_account", Date.now() - toolStart);

          const accountData = result.account?.result?.[0] || result.account || result;

          const name = accountData.name || accountData.Name || "Petronas Malaysia";
          const rmName = accountData.assignedtoname || accountData.AssignedToName || "Mr. Shaukat Ahmad";
          const segment = accountData.acc_ex1_49 || accountData.Acc_ex1_49 || "Platinum";
          const ctcPhone = accountData.phone || accountData.Phone || "03-7982-9186";
          const ctcEmail = accountData.email || accountData.Email || "info@petronas.com";
          const branch = accountData.acc_ex2_68 || accountData.Acc_ex2_68 || "Malaysia";
          const industry = accountData.industry || accountData.Industry || "Finance/Banking";
          const customerRating = accountData.acc_ex1_43 || accountData.Acc_ex1_43 || 4.0;
          const constMoody = accountData.acc_ex4_28 || accountData.Acc_ex4_28 || "A1";
          const promoterInfo = accountData.htmltext_2872 || accountData.HtmlText_2872 || "N/A";
          const strengths = accountData.htmltext_2871 || accountData.HtmlText_2871 || "N/A";
          const pastExp = accountData.htmltext_2870 || accountData.HtmlText_2870 || "N/A";

          const headerTitle = name;
          const msg = lowerMessage.includes("babu")
            ? `I found Babu Thomas associated with Petronas Malaysia. Here is the Customer 360 overview for ${name}.`
            : `Retrieved Corporate Customer 360 profile for ${name} successfully.`;

          return {
            version: "1.0",
            title: `${headerTitle} - Corporate Customer 360`,
            subtitle: `Segment: ${segment} | RM: ${rmName}`,
            message: msg,
            layout: { type: "workspace", columns: 2 },
            components: [
              {
                type: "page_header",
                title: headerTitle,
                subtitle: `Active CRM Profile • Segment: ${segment} • RM: ${rmName}`
              },
              {
                type: "metric_group",
                title: "Relationship KPIs",
                data: [
                  { label: "Employees", value: accountData.acc_ex1_52 || ">10,000" },
                  { label: "Relationship since", value: accountData.acc_ex1_8 ? new Date(accountData.acc_ex1_8).toLocaleDateString('en-US', { month: 'short', year: 'numeric' }) : "Oct 2015" },
                  { label: "Account rating", value: `${customerRating} / 5.0` },
                  { label: "Onboarded", value: accountData.acc_ex2_87 ? new Date(accountData.acc_ex2_87).toLocaleDateString('en-US', { month: 'short', year: 'numeric' }) : "Jun 2018" },
                  { label: "Listed", value: accountData.acc_ex5_23 || "No" }
                ]
              },
              {
                type: "account_summary",
                title: "CONTACT DETAILS",
                data: {
                  "Phone": ctcPhone,
                  "Email": ctcEmail,
                  "Country": branch,
                  "Type": accountData.acc_ex5_97 || "Manufacturer"
                }
              },
              {
                type: "key_value_grid",
                title: "CREDIT RATINGS",
                data: [
                  { key: "ICRA", value: constMoody },
                  { key: "CRISIL", value: accountData.acc_ex4_45 || "P5" }
                ]
              }
            ],
            suggestedActions: [
              {
                id: "action_create_lead",
                label: "Create Lead",
                intent: `Create a new lead for ${name}`,
                requiresConfirmation: true,
                actionCategory: "WRITE",
                payload: {
                  name: "Petronas",
                  last_name: "Fintech Expansion",
                  mobile_phone: ctcPhone,
                  product: "Corporate SME Financing",
                  product_category: "Loans"
                }
              }
            ],
            metadata: {
              toolsUsed,
              executionTime: Date.now() - startTime
            }
          };
        } catch (err: any) {
          logReadAudit("get_account", Date.now() - toolStart, "error");
          return this.errorResponse(err.message, toolsUsed, startTime);
        }
      }
    }

    // Default Landing Page if no intent matched
    const defaultTitle = mode === "retail" ? "BUSINESSNEXT Retail Workspace" : "BUSINESSNEXT Corporate Workspace";
    return {
      version: "1.0",
      title: defaultTitle,
      subtitle: "Enterprise CRM Copilot Workspace",
      message: mode === "retail"
        ? `I understood: "${message}". In Retail workspace, you can query retail accounts (e.g. "Find customer 2356") or create leads.`
        : `I understood: "${message}". In Corporate workspace, you can query corporate accounts (e.g. "Find Petronas Malaysia") or create leads.`,
      layout: { type: "dashboard", columns: 1 },
      components: [
        {
          type: "empty_state",
          title: "What would you like to do in CRM today?",
          subtitle: "Use the command bar below to search customers, check details, or verify connection diagnostics."
        }
      ],
      metadata: {
        toolsUsed,
        executionTime: Date.now() - startTime
      }
    };
  }

  private errorResponse(
    error: string,
    toolsUsed: string[],
    startTime: number
  ): AIWorkspaceResponse {
    return {
      version: "1.0",
      title: "CRM Execution Error",
      subtitle: "MCP Connection Failed",
      message: `I was unable to complete this request. The CRM MCP server returned an error: "${error}".`,
      layout: { type: "dashboard", columns: 1 },
      components: [
        {
          type: "error",
          title: "Tool Execution Failed",
          data: { error }
        }
      ],
      metadata: {
        toolsUsed,
        executionTime: Date.now() - startTime
      }
    };
  }
}
