"use client";

import { Wallet } from "lucide-react";
import { ConnectButton } from "./ConnectButton";

interface ConnectWalletToInteractProps {
  action?: string;
  variant?: "light" | "dark";
}

/**
 * Shown when user is signed in with ZK Login but needs to connect a wallet
 * to sign transactions (create communities, post, become artist).
 */
export function ConnectWalletToInteract({
  action = "create content, post, or become an artist",
  variant = "dark",
}: ConnectWalletToInteractProps) {
  const isLight = variant === "light";
  const textClass = isLight ? "text-black/80" : "text-muted-foreground";
  const accentClass = isLight ? "text-black" : "text-foreground";

  return (
    <div className="rounded-xl glass-subtle border border-white/10 p-6 text-center space-y-4">
      <div className="flex justify-center">
        <div
          className={`inline-flex items-center justify-center w-12 h-12 rounded-full ${
            isLight ? "bg-black/5" : "bg-white/5"
          }`}
        >
          <Wallet className={`h-6 w-6 ${isLight ? "text-black/70" : "text-primary"}`} />
        </div>
      </div>
      <div className="space-y-1">
        <p className={`text-sm font-medium ${accentClass}`}>
          Connect a wallet to interact
        </p>
        <p className={`text-sm ${textClass} max-w-sm mx-auto`}>
          You&apos;re signed in with ZK Login. Browse freely — when you want to{" "}
          {action}, connect a wallet (Sui Wallet, Ethos) to sign transactions.
        </p>
      </div>
      <div className="flex justify-center pt-1">
        <ConnectButton variant={variant} />
      </div>
    </div>
  );
}
