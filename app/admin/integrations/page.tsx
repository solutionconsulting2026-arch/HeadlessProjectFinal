"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { 
  Activity, 
  Settings, 
  Terminal, 
  RefreshCw, 
  Database, 
  Cpu, 
  ShieldAlert, 
  CheckCircle2, 
  ArrowLeft,
  ChevronRight,
  ChevronDown,
  Info
} from "lucide-react";

export default function AdminIntegrations() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedTool, setExpandedTool] = useState<string | null>(null);

  const fetchDiagnostics = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/mcp");
      const json = await res.json();
      setData(json);
      setError(null);
    } catch (err: any) {
      setError(err.message || "Failed to fetch diagnostics");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDiagnostics();
  }, []);

  return (
    <div className="min-h-screen bg-[#F7F8FA] font-sans antialiased text-[#333333]">
      {/* Top Header */}
      <header className="sticky top-0 z-30 flex items-center justify-between border-b border-[#E5E7EB] bg-white px-8 py-4 shadow-sm">
        <div className="flex items-center space-x-4">
          <Link href="/" className="flex items-center text-[#E71A73] hover:text-[#EC2275]">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Workspace
          </Link>
          <span className="text-gray-300">|</span>
          <div className="flex items-center space-x-2">
            <Settings className="h-5 w-5 text-[#E71A73]" />
            <h1 className="text-xl font-bold tracking-tight text-[#333333] font-poppins">
              BUSINESSNEXT Administration
            </h1>
          </div>
        </div>
        <button 
          onClick={fetchDiagnostics}
          disabled={loading}
          className="flex items-center rounded-md border border-[#E5E7EB] bg-white px-3 py-1.5 text-sm text-[#595959] hover:bg-gray-50 active:bg-gray-100 disabled:opacity-50"
        >
          <RefreshCw className={`mr-2 h-4 w-4 ${loading ? "animate-spin" : ""}`} />
          Refresh
        </button>
      </header>

      <main className="mx-auto max-w-7xl px-8 py-8 space-y-8">
        {/* Status Indicators */}
        <section className="grid gap-6 md:grid-cols-3">
          {/* App Status Card */}
          <div className="rounded-lg border border-[#E5E7EB] bg-white p-6 shadow-sm">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <div className="rounded-full bg-pink-50 p-2 text-[#E71A73]">
                  <Cpu className="h-6 w-6" />
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wider">Application</h3>
                  <p className="text-lg font-bold text-gray-800">BUSINESSNEXT Workspace</p>
                </div>
              </div>
              <span className="inline-flex items-center rounded-full bg-green-50 px-2.5 py-0.5 text-xs font-semibold text-green-700">
                <CheckCircle2 className="mr-1 h-3.5 w-3.5 text-green-500" />
                Online
              </span>
            </div>
          </div>

          {/* OpenAI Status Card */}
          <div className="rounded-lg border border-[#E5E7EB] bg-white p-6 shadow-sm">
            {(() => {
              const llm = data?.llmProvider;
              const configured = llm?.configured || "none";
              const hasRecentError = !!llm?.lastError;
              const providerLabel = configured === "anthropic" ? "Anthropic API" : configured === "openai" ? "OpenAI API" : "AI Provider";
              const badgeLabel = configured === "none"
                ? "Not Configured"
                : hasRecentError
                ? `Last call failed (${llm.lastErrorProvider})`
                : llm?.lastUsedProvider && llm.lastUsedProvider !== "fallback"
                ? "Connected — verified"
                : `${configured === "anthropic" ? "Anthropic" : "OpenAI"} key present`;
              const badgeTone = configured === "none"
                ? "bg-gray-100 text-gray-600"
                : hasRecentError
                ? "bg-red-50 text-red-700"
                : llm?.lastUsedProvider && llm.lastUsedProvider !== "fallback"
                ? "bg-green-50 text-green-700"
                : "bg-amber-50 text-amber-700";
              return (
                <>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-3">
                      <div className="rounded-full bg-pink-50 p-2 text-[#E71A73]">
                        <Activity className="h-6 w-6" />
                      </div>
                      <div>
                        <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wider">{providerLabel}</h3>
                        <p className="text-lg font-bold text-gray-800">{llm?.model || "—"}</p>
                      </div>
                    </div>
                    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${badgeTone}`}>
                      {hasRecentError || configured === "none" ? (
                        <ShieldAlert className="mr-1 h-3.5 w-3.5" />
                      ) : (
                        <CheckCircle2 className="mr-1 h-3.5 w-3.5" />
                      )}
                      {badgeLabel}
                    </span>
                  </div>
                  {hasRecentError && (
                    <p className="mt-3 text-xs text-red-600 font-mono truncate" title={llm.lastError}>
                      {llm.lastError}
                    </p>
                  )}
                  {!hasRecentError && configured !== "none" && (!llm?.lastUsedProvider || llm.lastUsedProvider === "fallback") && (
                    <p className="mt-3 text-xs text-amber-600">
                      Key present, but no successful call recorded yet this session — a truly invalid key will show up here as &ldquo;Last call failed&rdquo; after the next query.
                    </p>
                  )}
                </>
              );
            })()}
          </div>

          {/* MCP Server Status Card */}
          <div className="rounded-lg border border-[#E5E7EB] bg-white p-6 shadow-sm">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <div className="rounded-full bg-pink-50 p-2 text-[#E71A73]">
                  <Database className="h-6 w-6" />
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wider">CRM MCP Server</h3>
                  <p className="text-xs text-gray-400 font-mono truncate max-w-[160px]">headlessmcp.vercel.app</p>
                </div>
              </div>
              <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                data?.connectionStatus === "Connected" ? "bg-green-50 text-green-700" : "bg-amber-50 text-amber-700"
              }`}>
                {data?.connectionStatus === "Connected" ? (
                  <CheckCircle2 className="mr-1 h-3.5 w-3.5 text-green-500" />
                ) : (
                  <ShieldAlert className="mr-1 h-3.5 w-3.5 text-amber-500" />
                )}
                {data?.connectionStatus || "Checking..."}
              </span>
            </div>
          </div>
        </section>

        {error && (
          <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-red-800">
            <h4 className="font-bold flex items-center">
              <ShieldAlert className="mr-2 h-5 w-5" /> Diagnostics Error
            </h4>
            <p className="text-sm mt-1">{error}</p>
          </div>
        )}

        {/* Discovered Tools list */}
        <section className="rounded-lg border border-[#E5E7EB] bg-white shadow-sm overflow-hidden">
          <div className="border-b border-[#E5E7EB] bg-gray-50 px-6 py-4 flex items-center justify-between">
            <h2 className="text-lg font-bold text-[#333333] flex items-center">
              <Terminal className="mr-2 h-5 w-5 text-[#E71A73]" />
              Discovered MCP Tools ({data?.discoveredTools?.length || 0})
            </h2>
            <span className="text-xs text-gray-400">Exposed dynamically by the remote server</span>
          </div>

          <div className="divide-y divide-[#E5E7EB]">
            {data?.discoveredTools?.map((tool: any) => {
              const isExpanded = expandedTool === tool.name;
              return (
                <div key={tool.name} className="p-6 space-y-4">
                  <div 
                    className="flex items-start justify-between cursor-pointer"
                    onClick={() => setExpandedTool(isExpanded ? null : tool.name)}
                  >
                    <div>
                      <div className="flex items-center space-x-2">
                        <h3 className="font-mono text-base font-bold text-[#E71A73]">{tool.name}</h3>
                        <span className="rounded bg-gray-100 px-2 py-0.5 text-xs text-gray-600 font-mono">
                          {Object.keys(tool.inputSchema?.properties || {}).length} arguments
                        </span>
                      </div>
                      <p className="text-sm text-[#595959] mt-1 whitespace-pre-line">{tool.description}</p>
                    </div>
                    {isExpanded ? (
                      <ChevronDown className="h-5 w-5 text-gray-400" />
                    ) : (
                      <ChevronRight className="h-5 w-5 text-gray-400" />
                    )}
                  </div>

                  {isExpanded && (
                    <div className="rounded-md bg-[#F7F8FA] border border-[#E5E7EB] p-4 font-mono text-xs">
                      <div className="text-[#333333] font-bold mb-2">Input Schema Properties:</div>
                      <table className="w-full text-left">
                        <thead>
                          <tr className="border-b border-gray-200 text-gray-500">
                            <th className="py-1">Property</th>
                            <th className="py-1">Type</th>
                            <th className="py-1">Required</th>
                            <th className="py-1">Default / Info</th>
                          </tr>
                        </thead>
                        <tbody>
                          {Object.entries(tool.inputSchema?.properties || {}).map(([key, val]: any) => (
                            <tr key={key} className="border-b border-gray-100 last:border-none">
                              <td className="py-1 text-[#E71A73] font-bold">{key}</td>
                              <td className="py-1 text-gray-600">{val.type}</td>
                              <td className="py-1">
                                {tool.inputSchema?.required?.includes(key) ? (
                                  <span className="text-red-500">true</span>
                                ) : (
                                  <span className="text-gray-400">false</span>
                                )}
                              </td>
                              <td className="py-1 text-gray-500">
                                {val.default !== undefined ? `Default: ${JSON.stringify(val.default)}` : ""}
                                {val.title && val.default === undefined ? val.title : ""}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              );
            })}
            {(!data?.discoveredTools || data?.discoveredTools?.length === 0) && (
              <div className="p-8 text-center text-gray-400">
                <Info className="mx-auto h-8 w-8 mb-2" />
                No tools discovered from the MCP server.
              </div>
            )}
          </div>
        </section>

        {/* Audit Log Trail */}
        <section className="rounded-lg border border-[#E5E7EB] bg-white shadow-sm overflow-hidden">
          <div className="border-b border-[#E5E7EB] bg-gray-50 px-6 py-4">
            <h2 className="text-lg font-bold text-[#333333] flex items-center">
              <Settings className="mr-2 h-5 w-5 text-[#E71A73]" />
              System Audit Trail (Server-side logs)
            </h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-sm">
              <thead>
                <tr className="border-b border-[#E5E7EB] bg-gray-50 font-semibold text-gray-600">
                  <th className="p-4">Timestamp</th>
                  <th className="p-4">Tool/Action</th>
                  <th className="p-4">Category</th>
                  <th className="p-4">Latency</th>
                  <th className="p-4">Status</th>
                  <th className="p-4">Correlation ID</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E5E7EB]">
                {data?.auditTrail?.map((record: any) => (
                  <tr key={record.id} className="hover:bg-gray-50">
                    <td className="p-4 text-gray-500 font-mono text-xs">
                      {new Date(record.timestamp).toLocaleTimeString()}
                    </td>
                    <td className="p-4 font-mono font-bold text-gray-800">{record.toolName}</td>
                    <td className="p-4">
                      <span className={`inline-flex rounded px-2 py-0.5 text-xs font-semibold ${
                        record.actionCategory === "DESTRUCTIVE" 
                          ? "bg-red-50 text-red-700" 
                          : record.actionCategory === "WRITE"
                          ? "bg-amber-50 text-amber-700"
                          : "bg-blue-50 text-blue-700"
                      }`}>
                        {record.actionCategory}
                      </span>
                    </td>
                    <td className="p-4 font-mono text-gray-600">{record.durationMs}ms</td>
                    <td className="p-4">
                      {record.status === "success" ? (
                        <span className="text-green-600 font-semibold flex items-center">
                          <CheckCircle2 className="mr-1 h-4 w-4 text-green-500" /> OK
                        </span>
                      ) : (
                        <span className="text-red-600 font-semibold flex items-center">
                          <ShieldAlert className="mr-1 h-4 w-4 text-red-500" /> FAILED
                        </span>
                      )}
                    </td>
                    <td className="p-4 text-gray-400 font-mono text-xs">{record.id}</td>
                  </tr>
                ))}
                {(!data?.auditTrail || data?.auditTrail.length === 0) && (
                  <tr>
                    <td colSpan={6} className="p-8 text-center text-gray-400">
                      No tool execution audit records generated yet. Run queries in the workspace.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
      </main>
    </div>
  );
}
