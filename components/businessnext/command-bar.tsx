"use client";

import React, { useState, KeyboardEvent, useEffect } from "react";
import { Send, Square, Sparkles, RefreshCw } from "lucide-react";

interface CommandBarProps {
  onSend: (message: string) => void;
  onStop: () => void;
  loading: boolean;
  loadingStage?: string;
  isInitial: boolean;
  mode?: "corporate" | "retail";
}

export default function CommandBar({
  onSend,
  onStop,
  loading,
  loadingStage,
  isInitial,
  mode = "corporate"
}: CommandBarProps) {
  const [input, setInput] = useState("");

  const suggestedPrompts = mode === "retail" ? [
    { label: "Show Ryan Gates", query: "Show Ryan Gates (ID 2356)" },
    { label: "Show Lead Anushka", query: "Show lead 13314" },
    { label: "Test CRM connection", query: "Test CRM connection status" }
  ] : [
    { label: "Show Petronas Malaysia", query: "Give me a 360 view of Petronas Malaysia (ID 2463)" },
    { label: "Create Babu Thomas Lead", query: "Create a lead for Babu Thomas" },
    { label: "Test CRM connection", query: "Test CRM connection status" }
  ];

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  const handleSubmit = () => {
    if (input.trim() && !loading) {
      onSend(input.trim());
      setInput("");
    }
  };

  return (
    <div className="w-full space-y-4 max-w-4xl mx-auto">
      {/* Suggested Prompts Cards */}
      {isInitial && !loading && (
        <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-3 pt-4">
          {suggestedPrompts.map((p, idx) => (
            <button
              key={idx}
              onClick={() => onSend(p.query)}
              className="flex flex-col text-left rounded-lg border border-[#E5E7EB] bg-white p-4 hover:border-[#E71A73] hover:shadow-sm transition-all"
            >
              <span className="flex items-center text-[#E71A73] text-xs font-bold uppercase tracking-wider mb-1 font-poppins">
                <Sparkles size={12} className="mr-1.5" />
                Prompt
              </span>
              <span className="text-sm font-medium text-gray-700">{p.label}</span>
            </button>
          ))}
        </div>
      )}

      {/* Main Command Input Box */}
      <div className="relative flex items-center rounded-lg border border-[#E5E7EB] bg-white p-2.5 shadow-sm focus-within:border-[#E71A73] focus-within:ring-1 focus-within:ring-[#E71A73] transition-all">
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          disabled={loading}
          rows={2}
          placeholder="Ask BUSINESSNEXT AI about your customers, pipeline, activities or service requests..."
          className="w-full resize-none border-none bg-transparent py-1 px-2 text-sm text-gray-800 placeholder-gray-400 focus:outline-none focus:ring-0 disabled:opacity-50"
        />

        <div className="flex items-center space-x-3 shrink-0 pr-1">
          {loading && loadingStage && (
            <span className="hidden sm:flex items-center gap-1.5 text-[11px] font-semibold text-[#E71A73] animate-pulse">
              <RefreshCw size={11} className="animate-spin" />
              {loadingStage}
            </span>
          )}
          {loading ? (
            <button
              onClick={onStop}
              className="flex h-10 w-10 items-center justify-center rounded-lg bg-gray-100 hover:bg-gray-200 text-gray-600 active:bg-gray-300 transition-colors"
            >
              <Square size={16} />
            </button>
          ) : (
            <button
              onClick={handleSubmit}
              disabled={!input.trim()}
              className="flex h-10 w-10 items-center justify-center rounded-lg bg-[#E71A73] text-white hover:bg-[#EC2275] active:bg-[#C2115B] disabled:opacity-30 disabled:hover:bg-[#E71A73] transition-colors"
            >
              <Send size={16} />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
