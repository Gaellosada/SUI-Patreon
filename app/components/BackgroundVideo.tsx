"use client";

import { useEffect, useCallback, useRef } from "react";

const VIDEO_URL =
  "https://assets.mixkit.co/videos/preview/mixkit-blue-sea-water-texture-waving-gently-50165-large.mp4";

export function BackgroundVideo() {
  const mouseRef = useRef({ x: 50, y: 50 });
  const smoothRef = useRef({ x: 50, y: 50 });
  const glowRef = useRef<HTMLDivElement>(null);
  const spotlightRef = useRef<HTMLDivElement>(null);

  const handleMouseMove = useCallback((e: MouseEvent) => {
    mouseRef.current = {
      x: (e.clientX / window.innerWidth) * 100,
      y: (e.clientY / window.innerHeight) * 100,
    };
  }, []);

  useEffect(() => {
    window.addEventListener("mousemove", handleMouseMove, { passive: true });
    return () => window.removeEventListener("mousemove", handleMouseMove);
  }, [handleMouseMove]);

  // Smooth follow via direct DOM updates (no React re-renders, no 60fps state updates)
  useEffect(() => {
    let rafId: number;
    const tick = () => {
      const m = mouseRef.current;
      const prev = smoothRef.current;
      const x = prev.x + (m.x - prev.x) * 0.08;
      const y = prev.y + (m.y - prev.y) * 0.08;
      smoothRef.current = { x, y };
      const glow = glowRef.current;
      const spotlight = spotlightRef.current;
      if (glow) {
        glow.style.background = `radial-gradient(
          ellipse 80vmax 60vmax at ${x}% ${y}%,
          rgba(148, 163, 184, 0.35) 0%,
          rgba(100, 116, 139, 0.15) 25%,
          rgba(51, 65, 85, 0.08) 50%,
          transparent 70%
        )`;
      }
      if (spotlight) {
        spotlight.style.background = `radial-gradient(
          circle 40vmax at ${x}% ${y}%,
          rgba(226, 232, 240, 0.2) 0%,
          rgba(148, 163, 184, 0.08) 30%,
          transparent 60%
        )`;
      }
      rafId = requestAnimationFrame(tick);
    };
    rafId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafId);
  }, []);

  return (
    <div className="fixed inset-0 -z-10 overflow-hidden">
      {/* Foggy base - soft watery gradients */}
      <div
        className="absolute inset-0"
        style={{
          background:
            "linear-gradient(160deg, #0c4a6e 0%, #0f172a 25%, #1e3a5f 50%, #0c4a6e 75%, #0f172a 100%)",
          filter: "blur(0px)",
        }}
      />
      <div
        className="absolute inset-0 opacity-70"
        style={{
          background:
            "linear-gradient(200deg, rgba(6,182,212,0.4) 0%, transparent 40%, rgba(99,102,241,0.2) 70%, transparent 100%)",
          backgroundSize: "200% 200%",
          animation: "gradient-shift 20s ease infinite",
          filter: "blur(24px)",
        }}
      />
      <div
        className="absolute inset-0 opacity-50"
        style={{
          background:
            "linear-gradient(120deg, transparent 0%, rgba(34,211,238,0.25) 30%, transparent 60%, rgba(129,140,248,0.2) 100%)",
          backgroundSize: "300% 300%",
          animation: "gradient-shift 25s ease-in-out infinite reverse",
          filter: "blur(32px)",
        }}
      />

      {/* Water video - subtle texture, preload=metadata defers full download */}
      <video
        autoPlay
        muted
        loop
        playsInline
        preload="metadata"
        className="absolute inset-0 w-full h-full object-cover opacity-25 mix-blend-soft-light"
      >
        <source src={VIDEO_URL} type="video/mp4" />
      </video>

      {/* Mouse-following light - foggy glow (updated via ref, no re-renders) */}
      <div
        ref={glowRef}
        className="absolute inset-0 pointer-events-none transition-none"
        style={{
          background: "radial-gradient(ellipse 80vmax 60vmax at 50% 50%, rgba(148, 163, 184, 0.35) 0%, rgba(100, 116, 139, 0.15) 25%, rgba(51, 65, 85, 0.08) 50%, transparent 70%)",
          filter: "blur(16px)",
        }}
      />

      {/* Inner spotlight - brighter core following cursor */}
      <div
        ref={spotlightRef}
        className="absolute inset-0 pointer-events-none"
        style={{
          background: "radial-gradient(circle 40vmax at 50% 50%, rgba(226, 232, 240, 0.2) 0%, rgba(148, 163, 184, 0.08) 30%, transparent 60%)",
          filter: "blur(20px)",
        }}
      />

      {/* Glassy fog overlay - ties it together */}
      <div
        className="absolute inset-0 bg-gradient-to-b from-[#0f172a]/60 via-[#0f172a]/40 to-[#0c1222]/70 backdrop-blur-[2px]"
        aria-hidden
      />
    </div>
  );
}
