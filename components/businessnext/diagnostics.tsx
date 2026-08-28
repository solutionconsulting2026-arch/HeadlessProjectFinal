"use client";

import React, { useState, useEffect } from "react";
import { Terminal, Database, ShieldCheck, HelpCircle, RefreshCw } from "lucide-react";

interface DiagnosticsProps {
  toolsUsed?: string[];
  executionTime?: number;
}

export default function Diagnostics({ toolsUsed = [], executionTime = 0 }: DiagnosticsProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [mcpData, setMcpData] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  const fetchDiagnostics = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/mcp");
      const json = await res.json();
      setMcpData(json);
    } catch (e) {
      console.error("Failed to load mcp diagnostics in drawer", e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchDiagnostics();
    }
  }, [isOpen]);

  return (
    <div className="fixed bottom-0 right-0 z-40 max-w-lg w-full bg-white border-t border-l border-[#E5E7EB] shadow-2xl transition-all rounded-tl-lg overflow-hidden">
      {/* Header bar */}
      <div 
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center justify-between bg-gray-900 px-4 py-3 text-white cursor-pointer select-none"
      >
        <div className="flex items-center space-x-2">
          <Terminal size={14} className="text-[#E71A73]" />
          <span className="text-xs font-bold font-mono tracking-wider">BN-AI Diagnostics / Activity</span>
        </div>
        <span className="text-xs font-bold underline text-gray-400 hover:text-white">
          {isOpen ? "Collapse" : "Expand"}
        </span>
      </div>

      {isOpen && (
        <div className="p-4 space-y-4 max-h-[360px] overflow-y-auto font-mono text-xs text-gray-700 bg-gray-50 border-t border-gray-200">
          {/* Summary Row */}
          <div className="flex items-center justify-between border-b pb-2">
            <span className="font-bold flex items-center">
              <Database size={13} className="mr-1 text-gray-500" />
              MCP Server Status:
            </span>
            <span className={`font-bold uppercase ${
              mcpData?.connectionStatus === "Connected" ? "text-green-600" : "text-amber-600"
            }`}>
              {mcpData?.connectionStatus || "Pending..."}
            </span>
          </div>

          {/* AI Activity */}
          <div className="space-y-1.5 border-b pb-2">
            <div className="font-bold text-[#E71A73]">AI Operational Trail:</div>
            <div className="grid grid-cols-2 gap-y-1 pl-2">
              <span className="text-gray-500">Query Intent:</span>
              <span className="text-gray-800 font-bold">{toolsUsed.length > 0 ? "CRM Retrieval" : "Conversational"}</span>
              
              <span className="text-gray-500">MCP Tools Used:</span>
              <span className="text-[#E71A73] font-bold">
                {toolsUsed.length > 0 ? toolsUsed.join(", ") : "none"}
              </span>

              <span className="text-gray-500">Execution Latency:</span>
              <span className="text-gray-800 font-bold">{executionTime ? `${executionTime} ms` : "N/A"}</span>
            </div>
          </div>

          {/* Discovered Tools summary */}
          <div className="space-y-1 border-b pb-2">
            <div className="font-bold text-gray-800 flex justify-between items-center">
              <span>Discovered Tools ({mcpData?.discoveredTools?.length || 0}):</span>
              <button 
                onClick={fetchDiagnostics} 
                disabled={loading}
                className="text-gray-400 hover:text-gray-600"
              >
                <RefreshCw size={11} className={loading ? "animate-spin" : ""} />
              </button>
            </div>
            <div className="pl-2 space-y-1">
              {mcpData?.discoveredTools?.map((t: any) => (
                <div key={t.name} className="flex justify-between">
                  <span className="text-blue-600 font-bold">{t.name}</span>
                  <span className="text-gray-400">({Object.keys(t.inputSchema?.properties || {}).length} args)</span>
                </div>
              ))}
            </div>
          </div>

          {/* Last tool execution */}
          {mcpData?.lastToolInvocation && (
            <div className="space-y-1">
              <div className="font-bold text-gray-800">Last Tool Invocation:</div>
              <div className="rounded border bg-white p-2.5 space-y-1">
                <div className="flex justify-between">
                  <span className="font-bold text-[#E71A73]">{mcpData.lastToolInvocation.toolName}</span>
                  <span className={mcpData.lastToolInvocation.status === "success" ? "text-green-600 font-bold" : "text-red-600 font-bold"}>
                    {mcpData.lastToolInvocation.status.toUpperCase()}
                  </span>
                </div>
                <div className="flex justify-between text-[10px] text-gray-400">
                  <span>Latency: {mcpData.lastToolInvocation.durationMs}ms</span>
                  <span>{new Date(mcpData.lastToolInvocation.timestamp).toLocaleTimeString()}</span>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
