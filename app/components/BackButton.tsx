"use client";

import { useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";

interface BackButtonProps {
  label?: string;
  className?: string;
}

export function BackButton({ label = "Back", className }: BackButtonProps) {
  const router = useRouter();

  const handleBack = () => {
    if (
      typeof window !== "undefined" &&
      document.referrer &&
      new URL(document.referrer).origin === window.location.origin
    ) {
      router.back();
    } else {
      router.push("/");
    }
  };

  return (
    <button
      type="button"
      onClick={handleBack}
      className={
        className ??
        "inline-flex items-center gap-2 text-sm text-foreground/80 hover:text-foreground mb-8 transition-colors"
      }
    >
      <ArrowLeft className="h-4 w-4" />
      {label}
    </button>
  );
}
