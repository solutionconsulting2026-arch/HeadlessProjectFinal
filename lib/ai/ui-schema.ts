import { z } from "zod";

// Definition of all possible UI component types
export const UIComponentTypeEnum = z.enum([
  "page_header",
  "metric",
  "metric_group",
  "customer_summary",
  "customer_360",
  "account_summary",
  "lead_summary",
  "service_request_summary",
  "key_value_grid",
  "data_table",
  "pipeline",
  "timeline",
  "activity_list",
  "relationship_hierarchy",
  "insight_card",
  "recommendation_card",
  "alert",
  "status_badge",
  "bar_chart",
  "line_chart",
  "donut_chart",
  "area_chart",
  "progress",
  "action_panel",
  "confirmation",
  "success",
  "error",
  "empty_state",
  "markdown",
]);

export const UIComponentSchema = z.object({
  type: UIComponentTypeEnum,
  title: z.string().optional(),
  subtitle: z.string().optional(),
  data: z.any().optional(), // Raw data (e.g. table rows, metric values, chart data)
  props: z.record(z.string(), z.any()).optional(), // Layout props, column configs, visual configurations
});

export const SuggestedActionSchema = z.object({
  id: z.string(),
  label: z.string(),
  icon: z.string().optional(), // Lucide icon name
  intent: z.string(), // Text query representing this action (e.g., "Schedule a meeting with Babu Thomas")
  requiresConfirmation: z.boolean().default(false),
  actionCategory: z.enum(["READ", "WRITE", "DESTRUCTIVE"]).default("READ"),
  payload: z.record(z.string(), z.any()).optional(), // Technical arguments for the action if pre-compiled
});

export const AIWorkspaceResponseSchema = z.object({
  version: z.string().default("1.0"),
  title: z.string().optional(),
  subtitle: z.string().optional(),
  message: z.string().optional(), // AI text summary/prose
  layout: z
    .object({
      type: z.enum(["dashboard", "detail", "list", "workspace"]),
      columns: z.number().optional().default(1),
    })
    .optional(),
  components: z.array(UIComponentSchema),
  suggestedActions: z.array(SuggestedActionSchema).optional(),
  metadata: z
    .object({
      toolsUsed: z.array(z.string()).optional(),
      executionTime: z.number().optional(),
    })
    .optional(),
});

export type UIComponent = z.infer<typeof UIComponentSchema>;
export type SuggestedAction = z.infer<typeof SuggestedActionSchema>;
export type AIWorkspaceResponse = z.infer<typeof AIWorkspaceResponseSchema>;
