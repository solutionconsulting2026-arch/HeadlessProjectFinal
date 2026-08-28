"use client";

import React, { useState, useEffect } from "react";
import { X, Loader2, Sparkles, User, Calendar, ShieldAlert } from "lucide-react";
import Canvas from "./canvas";
import { AIWorkspaceResponse } from "@/lib/ai/ui-schema";

interface LeadDrawerProps {
  leadId: string | null;
  mode: "corporate" | "retail";
  onClose: () => void;
}

export default function LeadDrawer({ leadId, mode, onClose }: LeadDrawerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [response, setResponse] = useState<AIWorkspaceResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (leadId) {
      setIsOpen(true);
      fetchLeadDetails(leadId);
    } else {
      setIsOpen(false);
      setResponse(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [leadId]);

  const fetchLeadDetails = async (id: string) => {
    setLoading(true);
    setError(null);
    setResponse(null);

    try {
      // Execute the lead lookup message based on workspace mode
      const query = mode === "retail" ? `Show lead ${id}` : `Show lead ${id}`;
      
      const res = await fetch("/api/agent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: query,
          conversationId: "drawer-conv-101",
          mode: "retail"
        })
      });

      if (!res.ok) throw new Error("Failed to fetch lead profile");
      const data = await res.json();
      setResponse(data);
    } catch (err: any) {
      console.error(err);
      setError(err.message || "An error occurred while loading lead 360.");
    } finally {
      setLoading(false);
    }
  };

  if (!leadId) return null;

  return (
    <div className={`fixed inset-0 z-50 overflow-hidden font-poppins transition-opacity duration-300 ${
      isOpen ? "opacity-100" : "opacity-0 pointer-events-none"
    }`}>
      {/* Backdrop Overlay */}
      <div 
        className="absolute inset-0 bg-black/40 backdrop-blur-sm transition-opacity" 
        onClick={onClose}
      />

      <div className="absolute inset-y-0 right-0 pl-10 max-w-full flex">
        {/* Drawer Frame */}
        <div className={`w-screen max-w-2xl bg-[#F7F8FA] shadow-2xl flex flex-col transform transition-transform duration-300 ease-out border-l border-gray-200 ${
          isOpen ? "translate-x-0" : "translate-x-full"
        }`}>
          {/* Header Panel */}
          <div className="bg-white border-b border-[#E5E7EB] px-6 py-4 flex items-center justify-between shrink-0">
            <div className="flex items-center space-x-2">
              <div className="p-1.5 rounded bg-pink-50 text-[#E71A73]">
                <Sparkles size={16} />
              </div>
              <div>
                <h3 className="text-base font-bold text-gray-800">
                  Lead 360 Profile Panel
                </h3>
                <p className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">
                  Lead ID: {leadId} • Segment: {mode === "retail" ? "Retail" : "Corporate"}
                </p>
              </div>
            </div>
            
            <button 
              onClick={onClose}
              className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-500 hover:text-gray-800 transition-colors"
            >
              <X size={18} />
            </button>
          </div>

          {/* Scrollable Content Workspace */}
          <div className="flex-1 overflow-y-auto p-6 relative">
            {loading ? (
              <div className="absolute inset-0 flex flex-col items-center justify-center space-y-3 bg-white/70">
                <Loader2 className="h-8 w-8 animate-spin text-[#E71A73]" />
                <span className="text-xs font-semibold text-gray-500">
                  Retrieving Lead 360 profile from CRM...
                </span>
              </div>
            ) : error ? (
              <div className="rounded-lg bg-red-50 border border-red-200 p-6 text-xs text-red-800 flex items-start space-x-3 mt-4">
                <ShieldAlert className="h-5 w-5 text-red-500 shrink-0" />
                <div>
                  <span className="font-bold block mb-1">Lookup Error</span>
                  <span>{error}</span>
                </div>
              </div>
            ) : response ? (
              <div className="space-y-6">
                <Canvas
                  title={response.title}
                  subtitle={response.subtitle}
                  message={response.message}
                  layout={response.layout}
                  components={response.components}
                  suggestedActions={[]}
                  onActionClick={() => {}}
                  onExecuteWrite={async () => {}}
                  actionPending={false}
                  actionResult={null}
                  actionError={null}
                />
              </div>
            ) : (
              <div className="text-center py-12 text-xs text-gray-400">
                No data loaded for Lead {leadId}.
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
