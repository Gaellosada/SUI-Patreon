"use client";

import { SuiNSearchBar } from "./SuiNSearchBar";

export interface SearchBarSectionProps {
  isConnected?: boolean;
}

export function SearchBarSection({ isConnected = false }: SearchBarSectionProps) {
  return (
    <section className="snap-section relative min-h-screen py-36 md:py-48 px-6 overflow-hidden">
      {/* Animated gradient background */}
      <div
        className="absolute inset-0 opacity-90"
        style={{
          background:
            "linear-gradient(to bottom, #0f172a 0%, #0e2035 25%, #0d2438 50%, #0e2035 75%, #0f172a 100%)",
          backgroundSize: "400% 400%",
          animation: "gradient-shift 15s ease infinite",
        }}
      />
      <div
        className="absolute inset-0 opacity-25"
        style={{
          background:
            "linear-gradient(225deg, rgba(30,58,95,0.5) 0%, transparent 40%, rgba(30,58,95,0.3) 80%, transparent 100%)",
          backgroundSize: "300% 300%",
          animation: "gradient-shift 20s ease-in-out infinite reverse",
        }}
      />
      {/* Shimmer overlay */}
      <div
        className="absolute inset-0 opacity-20 pointer-events-none"
        style={{
          background:
            "linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.08) 50%, transparent 100%)",
          backgroundSize: "200% 100%",
          animation: "shimmer 6s ease-in-out infinite",
        }}
      />

      <div className="relative max-w-4xl mx-auto flex flex-col items-center justify-center">
        <h2
          className="text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-bold text-white text-center tracking-tight mb-12 md:mb-16"
          style={{ textShadow: "0 2px 20px rgba(0,0,0,0.2)" }}
        >
          Find your favorite creators with SuiNS
        </h2>
        <SuiNSearchBar isConnected={isConnected} />
      </div>
    </section>
  );
}
