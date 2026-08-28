"use client";

import React from "react";

interface LoadingScreenProps {
  stage: string;
}

export default function LoadingScreen({ stage }: LoadingScreenProps) {
  // Recreate 15 wave nodes representing the logo chevrons
  const waveNodes = Array.from({ length: 15 });

  return (
    <div className="flex flex-col items-center justify-center min-h-[400px] w-full bg-[#F7F8FA] p-8 rounded-xl border border-gray-100 flex-1 font-poppins">
      
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

      {/* Active Stage Label */}
      <p className="mt-4 text-xs font-semibold text-[#757575] animate-pulse">
        {stage || "Orchestrating CRM resources..."}
      </p>

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
