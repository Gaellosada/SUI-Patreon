"use client";

import { ChevronDown } from "lucide-react";

export function IntroSection() {
  return (
    <section
      className="snap-section min-h-screen flex flex-col items-center justify-center px-6 relative"
      style={{
        background:
          "linear-gradient(to bottom, #ffffff 0%, #f5f6f8 25%, #e4e8ed 50%, #b8c4d0 75%, #7e8fa0 100%)",
      }}
    >
      <h1
        className="text-5xl sm:text-6xl md:text-7xl lg:text-8xl xl:text-9xl font-bold text-black text-center max-w-5xl leading-tight"
        style={{ textShadow: "0 1px 2px rgba(0,0,0,0.05)" }}
      >
        Be yourself, follow your art.
      </h1>
      <p
        className="mt-12 md:mt-16 text-black/60 text-sm sm:text-base font-medium animate-bounce"
        style={{ animationDuration: "2s" }}
      >
        <ChevronDown className="h-6 w-6 mx-auto" />
        Scroll to explore
      </p>
    </section>
  );
}
