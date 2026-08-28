"use client";

import React, { useState, useEffect } from "react";
import Shell from "@/components/businessnext/shell";
import CommandBar from "@/components/businessnext/command-bar";
import Canvas from "@/components/businessnext/canvas";
import Login from "@/components/businessnext/login";
import LoadingScreen from "@/components/businessnext/loading-screen";
import LeadDrawer from "@/components/businessnext/lead-drawer";
import { AIWorkspaceResponse } from "@/lib/ai/ui-schema";
import { 
  Sparkles,
  FolderOpen,
  UserCheck,
  FileText
} from "lucide-react";

export default function WorkspaceHome() {
  const [session, setSession] = useState<{ email: string; mode: "corporate" | "retail" } | null>(null);
  const [activeTab, setActiveTab] = useState("home");
  const [recentConversations, setRecentConversations] = useState<string[]>([]);
  
  // Conversational context state
  const [chatHistory, setChatHistory] = useState<{ role: "user" | "assistant"; content: string }[]>([]);
  
  // Slide-out Lead Details Drawer state
  const [activeDrawerLeadId, setActiveDrawerLeadId] = useState<string | null>(null);

  const [loading, setLoading] = useState(false);
  const [loadingStage, setLoadingStage] = useState("");
  const [response, setResponse] = useState<AIWorkspaceResponse | null>(null);
  
  // Confirmed Write action states
  const [actionPending, setActionPending] = useState(false);
  const [actionResult, setActionResult] = useState<any>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  // Restore session from localStorage on initial load
  useEffect(() => {
    const saved = localStorage.getItem("crm_session");
    if (saved) {
      try {
        setSession(JSON.parse(saved));
      } catch (e) {
        console.error("Failed to parse restored session", e);
      }
    }
  }, []);

  // Global window binding for opening the slide-over lead drawer
  useEffect(() => {
    (window as any).onOpenLeadDrawer = (leadId: string) => {
      setActiveDrawerLeadId(leadId);
    };
    return () => {
      delete (window as any).onOpenLeadDrawer;
    };
  }, []);

  // Tab change syncs with preset queries based on active session mode
  useEffect(() => {
    if (activeTab !== "home" && session) {
      let query = "";
      if (session.mode === "retail") {
        if (activeTab === "customers") query = "Show Ryan Gates (ID 2356)";
        else if (activeTab === "leads") query = "Create a lead for Anushka Singhania";
        else if (activeTab === "service") query = "Test CRM connection status";
        else if (activeTab === "insights") query = "Test CRM connection status";
        else if (activeTab === "opportunities") query = "Show pipeline status";
        else if (activeTab === "activities") query = "Show today's meetings";
      } else {
        if (activeTab === "customers") query = "Show Petronas Malaysia (ID 2463)";
        else if (activeTab === "leads") query = "Create a lead for Babu Thomas";
        else if (activeTab === "service") query = "Test CRM connection status";
        else if (activeTab === "insights") query = "Test CRM connection status";
        else if (activeTab === "opportunities") query = "Show pipeline status";
        else if (activeTab === "activities") query = "Show today's meetings";
      }
      
      if (query) {
        handleSendQuery(query);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab]);

  const handleSendQuery = async (query: string) => {
    if (!session) return;
    setLoading(true);
    setActionResult(null);
    setActionError(null);
    setResponse(null);

    // Sequence loading stages to show real activity progress
    const stages = [
      "Understanding query...",
      "Executing MCP tools...",
      "Retrieving account data...",
      "Rendering account insights..."
    ];

    let stageIdx = 0;
    setLoadingStage(stages[0]);
    const stageInterval = setInterval(() => {
      stageIdx++;
      if (stageIdx < stages.length) {
        setLoadingStage(stages[stageIdx]);
      }
    }, 800);

    try {
      const res = await fetch("/api/agent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: query,
          conversationId: "conv-101",
          mode: session.mode,
          history: chatHistory
        })
      });
      const data = await res.json();
      clearInterval(stageInterval);

      setResponse(data);
      
      // Save query/response to thread context
      setChatHistory(prev => [
        ...prev,
        { role: "user" as const, content: query },
        { role: "assistant" as const, content: JSON.stringify(data) }
      ].slice(-10)); // Keep last 10 interactions for tokens
      
      // Add to recents
      if (!recentConversations.includes(query)) {
        setRecentConversations([query, ...recentConversations].slice(0, 8));
      }
    } catch (err: any) {
      clearInterval(stageInterval);
      console.error(err);
      setActionError(err.message || "Query failed");
    } finally {
      setLoading(false);
    }
  };

  const handleExecuteWrite = async (action: string, payload: any) => {
    setActionPending(true);
    setActionError(null);
    setActionResult(null);

    try {
      const res = await fetch("/api/actions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action,
          payload,
          conversationId: "conv-101"
        })
      });
      const data = await res.json();
      if (data.status === "success") {
        setActionResult(data.data);
      } else {
        setActionError(data.message || "Failed to execute write action");
      }
    } catch (err: any) {
      console.error(err);
      setActionError(err.message || "Write execution failed");
    } finally {
      setActionPending(false);
    }
  };

  const handleNewConversation = () => {
    setResponse(null);
    setActionResult(null);
    setActionError(null);
    setChatHistory([]);
    setActiveDrawerLeadId(null);
    setActiveTab("home");
  };

  const handleLoginSuccess = (mode: "corporate" | "retail") => {
    const newSession = { email: "james@crmnext.com", mode };
    setSession(newSession);
    localStorage.setItem("crm_session", JSON.stringify(newSession));
    handleNewConversation();
  };

  const handleLogout = () => {
    setSession(null);
    localStorage.removeItem("crm_session");
    setResponse(null);
    setActionResult(null);
    setActionError(null);
    setChatHistory([]);
    setActiveDrawerLeadId(null);
  };

  // Render Login view if session is not active
  if (!session) {
    return <Login onLoginSuccess={handleLoginSuccess} />;
  }

  return (
    <Shell
      activeTab={activeTab}
      setActiveTab={setActiveTab}
      recentConversations={recentConversations}
      onSelectRecent={handleSendQuery}
      onNewConversation={handleNewConversation}
      workspaceMode={session.mode}
      onLogout={handleLogout}
    >
      <div className="flex-1 flex flex-col items-center justify-between min-h-0">
        
        {/* Main content viewport - overflow-visible ensures no nested scroll clipping */}
        <div className="w-full flex-1 flex flex-col mb-6">
          {loading ? (
            /* Premium loading screen layout */
            <LoadingScreen stage={loadingStage} />
          ) : response ? (
            /* Dynamic Result Canvas View */
            <Canvas
              title={response.title}
              subtitle={response.subtitle}
              message={response.message}
              layout={response.layout}
              components={response.components}
              suggestedActions={response.suggestedActions}
              onActionClick={handleSendQuery}
              onExecuteWrite={handleExecuteWrite}
              actionPending={actionPending}
              actionResult={actionResult}
              actionError={actionError}
            />
          ) : (
            /* Landing Screen Card Grid */
            <div className="w-full max-w-4xl mx-auto space-y-10 py-8 flex-1 flex flex-col justify-center">
              <div className="text-center space-y-3">
                <h1 className="text-3xl font-black tracking-tight text-gray-800 font-poppins animate-[fade-in_0.5s_ease-out]">
                  Good afternoon, Aditya
                </h1>
                <p className="text-sm text-[#595959] font-medium">
                  Welcome to your {session.mode === "retail" ? "Retail" : "Corporate"} Workspace. What would you like to do?
                </p>
              </div>

              {/* Quick Action Tiles */}
              <div className="grid gap-4 sm:grid-cols-1 md:grid-cols-3">
                {session.mode === "retail" ? (
                  <>
                    <button
                      onClick={() => handleSendQuery("Show Ryan Gates (ID 2356)")}
                      className="flex items-start text-left rounded-2xl border border-[#E5E7EB] bg-white p-5 hover:border-[#E71A73] hover:shadow-md transition-all group"
                    >
                      <div className="rounded-xl bg-pink-50 p-2.5 text-[#E71A73] mr-4 shrink-0 transition-colors group-hover:bg-[#E71A73] group-hover:text-white">
                        <UserCheck size={18} />
                      </div>
                      <div>
                        <h4 className="font-extrabold text-sm text-gray-800 font-poppins">Retail Customer Search</h4>
                        <p className="text-xs text-gray-400 mt-1 leading-normal font-semibold">Open Ryan Gates profile (ID 2356).</p>
                      </div>
                    </button>

                    <button
                      onClick={() => handleSendQuery("Create a lead for Anushka Singhania")}
                      className="flex items-start text-left rounded-2xl border border-[#E5E7EB] bg-white p-5 hover:border-[#E71A73] hover:shadow-md transition-all group"
                    >
                      <div className="rounded-xl bg-pink-50 p-2.5 text-[#E71A73] mr-4 shrink-0 transition-colors group-hover:bg-[#E71A73] group-hover:text-white">
                        <Sparkles size={18} />
                      </div>
                      <div>
                        <h4 className="font-extrabold text-sm text-gray-800 font-poppins">Create Retail Lead</h4>
                        <p className="text-xs text-gray-400 mt-1 leading-normal font-semibold">Trigger write authorization flows to save new retail leads.</p>
                      </div>
                    </button>
                  </>
                ) : (
                  <>
                    <button
                      onClick={() => handleSendQuery("Show Petronas Malaysia (ID 2463)")}
                      className="flex items-start text-left rounded-2xl border border-[#E5E7EB] bg-white p-5 hover:border-[#E71A73] hover:shadow-md transition-all group"
                    >
                      <div className="rounded-xl bg-pink-50 p-2.5 text-[#E71A73] mr-4 shrink-0 transition-colors group-hover:bg-[#E71A73] group-hover:text-white">
                        <UserCheck size={18} />
                      </div>
                      <div>
                        <h4 className="font-extrabold text-sm text-gray-800 font-poppins">Corporate Customer Search</h4>
                        <p className="text-xs text-gray-400 mt-1 leading-normal font-semibold">Open Petronas Malaysia profile (ID 2463).</p>
                      </div>
                    </button>

                    <button
                      onClick={() => handleSendQuery("Create a lead for Babu Thomas")}
                      className="flex items-start text-left rounded-2xl border border-[#E5E7EB] bg-white p-5 hover:border-[#E71A73] hover:shadow-md transition-all group"
                    >
                      <div className="rounded-xl bg-pink-50 p-2.5 text-[#E71A73] mr-4 shrink-0 transition-colors group-hover:bg-[#E71A73] group-hover:text-white">
                        <Sparkles size={18} />
                      </div>
                      <div>
                        <h4 className="font-extrabold text-sm text-gray-800 font-poppins">Corporate Lead Creation</h4>
                        <p className="text-xs text-gray-400 mt-1 leading-normal font-semibold">Trigger write authorization flows to save new leads.</p>
                      </div>
                    </button>
                  </>
                )}

                <button
                  onClick={() => handleSendQuery("Test CRM connection status")}
                  className="flex items-start text-left rounded-2xl border border-[#E5E7EB] bg-white p-5 hover:border-[#E71A73] hover:shadow-md transition-all group"
                >
                  <div className="rounded-xl bg-pink-50 p-2.5 text-[#E71A73] mr-4 shrink-0 transition-colors group-hover:bg-[#E71A73] group-hover:text-white">
                    <FolderOpen size={18} />
                  </div>
                  <div>
                    <h4 className="font-extrabold text-sm text-gray-800 font-poppins">Ask CRM / Diagnostics</h4>
                    <p className="text-xs text-gray-400 mt-1 leading-normal font-semibold">Test health diagnostic check endpoints.</p>
                  </div>
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Command Bar Area */}
        <div className="w-full bg-[#F7F8FA] pt-6 pb-2 shrink-0">
          <CommandBar
            onSend={handleSendQuery}
            onStop={() => setLoading(false)}
            loading={loading}
            loadingStage={loadingStage}
            isInitial={false}
            mode={session.mode}
          />
        </div>
      </div>

      {/* Slide-out drawer displaying real-time Lead 360 overview */}
      <LeadDrawer
        leadId={activeDrawerLeadId}
        mode={session.mode}
        onClose={() => setActiveDrawerLeadId(null)}
      />
    </Shell>
  );
}
