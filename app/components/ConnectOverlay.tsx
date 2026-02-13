"use client";

import { useEffect } from "react";
import { createPortal } from "react-dom";
import { ConnectButton } from "./ConnectButton";
import { cn } from "@/lib/utils";

export interface ConnectOverlayProps {
  open: boolean;
  onClose: () => void;
  children?: React.ReactNode;
  className?: string;
}

/**
 * Overlay that prompts user to connect before viewing a profile.
 * Shows Connect options (ZK Login, Wallet) with entrance animation.
 * Rendered via portal to avoid clipping by parent overflow/transform.
 */
export function ConnectOverlay({
  open,
  onClose,
  children,
  className,
}: ConnectOverlayProps) {
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    if (open) {
      document.addEventListener("keydown", handleEscape);
      document.body.style.overflow = "hidden";
    }
    return () => {
      document.removeEventListener("keydown", handleEscape);
      document.body.style.overflow = "";
    };
  }, [open, onClose]);

  if (!open) return null;

  const overlay = (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center p-4"
      onClick={onClose}
    >
      {/* Backdrop - subtle glassy overlay, no harsh black box */}
      <div
        className={cn(
          "absolute inset-0 bg-[#0f172a]/80 backdrop-blur-md",
          "animate-connect-overlay-bg"
        )}
      />

      {/* Content - smooth scale + slide up */}
      <div
        className={cn(
          "relative glass-light rounded-2xl p-8 max-w-sm w-full border border-white/15",
          "animate-connect-overlay-content",
          "shadow-2xl will-change-transform",
          className
        )}
        onClick={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          onClick={onClose}
          className="absolute top-4 right-4 p-1 rounded-lg text-muted-foreground hover:text-foreground hover:bg-white/10 transition-colors"
          aria-label="Close"
        >
          <svg
            className="h-5 w-5"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M6 18L18 6M6 6l12 12"
            />
          </svg>
        </button>

        {children}

        <div className="flex justify-center mt-6">
          <ConnectButton />
        </div>
      </div>
    </div>
  );

  return typeof document !== "undefined"
    ? createPortal(overlay, document.body)
    : null;
}
