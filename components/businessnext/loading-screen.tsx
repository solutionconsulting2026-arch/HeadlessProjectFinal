"use client";

import React from "react";
import { Check } from "lucide-react";

export const LOADING_STAGES = [
  "Understanding query...",
  "Executing MCP tools...",
  "Retrieving account data...",
  "Rendering account insights..."
];

interface LoadingScreenProps {
  stageIndex: number;
}

export default function LoadingScreen({ stageIndex }: LoadingScreenProps) {
  // Recreate 15 wave nodes representing the logo chevrons
  const waveNodes = Array.from({ length: 15 });

  return (
    <div className="flex flex-col items-center justify-center min-h-[420px] w-full bg-[#F7F8FA] p-8 rounded-xl border border-gray-100 flex-1 font-poppins">

      {/* Self-contained CSS for the 3D Chevron Swarm */}
      <style jsx>{`
        .swarm-container {
          perspective: 1000px;
          display: flex;
          align-items: center;
          justify-center: center;
          height: 80px;
          gap: 4px;
        }
        .chevron-node {
          width: 8px;
          height: 12px;
          background-color: #E71A73;
          clip-path: polygon(0% 0%, 60% 50%, 0% 100%, 40% 100%, 100% 50%, 40% 0%);
          animation: wave3d 1.8s infinite ease-in-out;
        }
        @keyframes wave3d {
          0%, 100% {
            transform: translateY(0px) rotateX(0deg) rotateY(0deg) scale(0.8);
            opacity: 0.3;
            filter: brightness(0.9);
          }
          50% {
            transform: translateY(-24px) rotateX(180deg) rotateY(90deg) scale(1.3);
            opacity: 1;
            filter: brightness(1.2);
          }
        }
      `}</style>

      {/* 3D Rolling Swarm Wave */}
      <div className="swarm-container mb-6">
        {waveNodes.map((_, i) => (
          <div
            key={i}
            className="chevron-node"
            style={{
              animationDelay: `${i * 0.1}s`,
            }}
          />
        ))}
      </div>

      {/* Brand Text */}
      <div className="text-center space-y-2">
        <img src="/logo-dark.png" alt="BUSINESSNEXT Logo" className="h-8 w-auto object-contain mx-auto" />
        <span className="text-[10px] font-bold uppercase tracking-widest text-[#757575] block mt-1">
          AI CRM Core Engine
        </span>
      </div>

      {/* Glowing Slide Loader */}
      <div className="w-56 h-1 bg-gray-200 rounded-full overflow-hidden mt-6 relative">
        <div className="h-full bg-gradient-to-r from-pink-500 to-[#E71A73] w-24 rounded-full absolute animate-[loading-slide_1.5s_infinite_ease-in-out]" />
      </div>

      {/* Live step checklist — shows real progress instead of just a spinner */}
      <div className="mt-7 w-full max-w-xs space-y-2.5">
        {LOADING_STAGES.map((label, idx) => {
          const isDone = idx < stageIndex;
          const isCurrent = idx === stageIndex;
          return (
            <div key={label} className="flex items-center gap-2.5 text-xs font-semibold transition-colors">
              <span
                className={`flex h-4 w-4 shrink-0 items-center justify-center rounded-full transition-colors ${
                  isDone
                    ? "bg-[#2E7D32] text-white"
                    : isCurrent
                    ? "bg-[#E71A73] animate-pulse"
                    : "bg-gray-200"
                }`}
              >
                {isDone && <Check size={10} strokeWidth={3.5} className="text-white" />}
              </span>
              <span className={isDone ? "text-gray-400 line-through" : isCurrent ? "text-gray-800" : "text-gray-300"}>
                {label}
              </span>
            </div>
          );
        })}
      </div>

      {/* Tailwind helper keyframe injection */}
      <style jsx global>{`
        @keyframes loading-slide {
          0% { left: -40%; }
          50% { left: 80%; }
          100% { left: -40%; }
        }
      `}</style>

    </div>
  );
}

/**
 * Compact loading state appended to the chat feed for follow-up queries — a shimmering
 * skeleton shaped like the incoming response card, so earlier turns stay put and the
 * user sees "something is being built" rather than a generic spinner.
 */
export function InlineThinkingIndicator({ stageIndex }: { stageIndex: number }) {
  return (
    <div className="w-full max-w-md rounded-xl border border-[#E5E7EB] bg-white p-5 shadow-sm self-start space-y-4 font-poppins overflow-hidden relative">
      <style jsx>{`
        .shimmer {
          position: relative;
          overflow: hidden;
          background-color: #EEF0F3;
        }
        .shimmer::after {
          content: "";
          position: absolute;
          inset: 0;
          transform: translateX(-100%);
          background: linear-gradient(90deg, transparent, rgba(231, 26, 115, 0.12), transparent);
          animation: shimmer-sweep 1.6s infinite;
        }
        @keyframes shimmer-sweep {
          100% { transform: translateX(100%); }
        }
        .bounce-dot {
          animation: bounce-dot 1.2s infinite ease-in-out;
        }
        @keyframes bounce-dot {
          0%, 80%, 100% { transform: translateY(0); opacity: 0.4; }
          40% { transform: translateY(-4px); opacity: 1; }
        }
      `}</style>

      <div className="flex items-center gap-2">
        <span className="h-2 w-2 rounded-full bg-[#E71A73] bounce-dot" style={{ animationDelay: "0ms" }} />
        <span className="h-2 w-2 rounded-full bg-[#E71A73] bounce-dot" style={{ animationDelay: "150ms" }} />
        <span className="h-2 w-2 rounded-full bg-[#E71A73] bounce-dot" style={{ animationDelay: "300ms" }} />
        <span className="text-xs font-bold text-[#757575] ml-1">{LOADING_STAGES[stageIndex]}</span>
      </div>

      <div className="space-y-2.5">
        <div className="shimmer h-4 w-2/5 rounded-md" />
        <div className="shimmer h-3 w-full rounded-md" />
        <div className="shimmer h-3 w-5/6 rounded-md" />
      </div>
      <div className="grid grid-cols-3 gap-2.5">
        <div className="shimmer h-12 rounded-lg" />
        <div className="shimmer h-12 rounded-lg" />
        <div className="shimmer h-12 rounded-lg" />
      </div>
    </div>
  );
}
