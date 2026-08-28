"use client";

import React from "react";
import ComponentRenderer from "./renderer";
import { UIComponent, SuggestedAction } from "@/lib/ai/ui-schema";
import { MessageSquare, Sparkles } from "lucide-react";

interface CanvasProps {
  title?: string;
  subtitle?: string;
  message?: string;
  layout?: {
    type: "dashboard" | "detail" | "list" | "workspace";
    columns?: number;
  };
  components: UIComponent[];
  suggestedActions?: SuggestedAction[];
  onActionClick: (intent: string) => void;
  onExecuteWrite: (action: string, payload: any) => Promise<void>;
  actionPending: boolean;
  actionResult: any;
  actionError: string | null;
}

export default function Canvas({
  title,
  subtitle,
  message,
  layout,
  components,
  suggestedActions = [],
  onActionClick,
  onExecuteWrite,
  actionPending,
  actionResult,
  actionError
}: CanvasProps) {
  const columns = layout?.columns || 1;

  return (
    <div className="flex-1 flex flex-col space-y-6 w-full pb-10">
      {/* Overview/Intro Header */}
      {(title || subtitle) && (
        <div className="rounded-lg border border-[#E5E7EB] bg-white p-6 shadow-sm">
          {title && <h1 className="text-2xl font-black text-gray-800 font-poppins tracking-tight">{title}</h1>}
          {subtitle && <p className="text-sm text-[#595959] mt-0.5">{subtitle}</p>}
        </div>
      )}

      {/* AI Message Panel */}
      {message && (
        <div className="rounded-lg border border-[#E5E7EB] bg-white p-5 shadow-sm">
          <p className="text-sm text-gray-700 leading-relaxed font-medium">
            {message}
          </p>
        </div>
      )}

      {/* Component Renderer manages grid and width internally */}
      <ComponentRenderer
        components={components}
        suggestedActions={suggestedActions}
        onActionClick={onActionClick}
        onExecuteWrite={onExecuteWrite}
        actionPending={actionPending}
        actionResult={actionResult}
        actionError={actionError}
      />
    </div>
  );
}
