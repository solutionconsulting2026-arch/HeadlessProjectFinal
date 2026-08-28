"use client";

import React, { useState } from "react";
import { Lock, Mail, Server, ShieldAlert } from "lucide-react";

interface LoginProps {
  onLoginSuccess: (mode: "corporate" | "retail") => void;
}

export default function Login({ onLoginSuccess }: LoginProps) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [mode, setMode] = useState<"corporate" | "retail">("corporate");
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsLoading(true);

    // Mock network latency for native feel
    setTimeout(() => {
      if (email === "james@crmnext.com" && password === "MCP@2026") {
        onLoginSuccess(mode);
      } else {
        setError("Invalid email credentials or password. Please use james@crmnext.com & MCP@2026.");
      }
      setIsLoading(false);
    }, 800);
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#F7F8FA] px-4 py-12 sm:px-6 lg:px-8 font-poppins">
      <div className="w-full max-w-md space-y-8 bg-white p-8 rounded-xl border border-[#E5E7EB] shadow-md">
        
        {/* Brand Header */}
        <div className="text-center">
          <div className="flex justify-center items-center">
            <img src="/logo-dark.png" alt="BUSINESSNEXT Logo" className="h-10 w-auto object-contain" />
          </div>
          <h2 className="mt-4 text-xl font-bold tracking-tight text-gray-800">
            Sign in to AI Workspace
          </h2>
          <p className="mt-1.5 text-xs text-[#7A7A7A]">
            Enter your CRM credentials to access the Operating interface
          </p>
        </div>

        {/* Login Form */}
        <form className="mt-6 space-y-6" onSubmit={handleSubmit}>
          {error && (
            <div className="rounded-lg bg-red-50 border border-red-200 p-4 text-xs text-red-800 flex items-start space-x-2">
              <ShieldAlert className="h-4 w-4 text-red-500 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          <div className="space-y-4">
            {/* Email Field */}
            <div>
              <label htmlFor="email" className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1.5">
                Work Email ID
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none text-gray-400">
                  <Mail size={16} />
                </div>
                <input
                  id="email"
                  type="email"
                  required
                  placeholder="james@crmnext.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="block w-full pl-10 pr-3 py-2.5 border border-[#E5E7EB] rounded-lg text-sm placeholder-gray-400 focus:outline-none focus:border-[#E71A73] focus:ring-1 focus:ring-[#E71A73] text-gray-800 transition-colors"
                />
              </div>
            </div>

            {/* Password Field */}
            <div>
              <label htmlFor="password" className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1.5">
                Password
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none text-gray-400">
                  <Lock size={16} />
                </div>
                <input
                  id="password"
                  type="password"
                  required
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="block w-full pl-10 pr-3 py-2.5 border border-[#E5E7EB] rounded-lg text-sm placeholder-gray-400 focus:outline-none focus:border-[#E71A73] focus:ring-1 focus:ring-[#E71A73] text-gray-800 transition-colors"
                />
              </div>
            </div>

            {/* Mode Segmented Toggle Card */}
            <div>
              <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">
                Workspace Domain Target
              </label>
              <div className="grid grid-cols-2 gap-2 bg-[#F3F4F6] p-1.5 rounded-lg border border-[#E5E7EB]">
                <button
                  type="button"
                  onClick={() => setMode("corporate")}
                  className={`py-2 text-xs font-bold rounded-md transition-all ${
                    mode === "corporate"
                      ? "bg-white text-gray-800 shadow-sm border border-gray-200"
                      : "text-gray-500 hover:text-gray-800"
                  }`}
                >
                  Corporate Mode
                </button>
                <button
                  type="button"
                  onClick={() => setMode("retail")}
                  className={`py-2 text-xs font-bold rounded-md transition-all ${
                    mode === "retail"
                      ? "bg-white text-gray-800 shadow-sm border border-gray-200"
                      : "text-gray-500 hover:text-gray-800"
                  }`}
                >
                  Retail Mode
                </button>
              </div>
            </div>
          </div>

          <div>
            <button
              type="submit"
              disabled={isLoading}
              className="flex w-full justify-center rounded-lg bg-[#E71A73] px-4 py-3 text-sm font-bold text-white shadow-sm hover:bg-[#EC2275] active:bg-[#C2115B] focus:outline-none disabled:opacity-50 transition-colors"
            >
              {isLoading ? "Signing in to CRM..." : "Access CRM Workspace"}
            </button>
          </div>
        </form>

        <div className="mt-4 border-t border-gray-100 pt-4 text-center">
          <span className="text-[10px] text-gray-400 font-mono tracking-wider flex items-center justify-center">
            <Server size={10} className="mr-1" /> Target Server: headlessmcp.vercel.app
          </span>
        </div>

      </div>
    </div>
  );
}
