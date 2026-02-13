"use client";

import { useCallback, useEffect, useState } from "react";
import {
  generateNonce,
  generateRandomness,
} from "@mysten/sui/zklogin";
import { Ed25519Keypair } from "@mysten/sui/keypairs/ed25519";
import { useSuiClient } from "@mysten/dapp-kit";
import { LogIn, LogOut, Loader2 } from "lucide-react";
import { Button } from "./ui/button";

interface ZKLoginButtonProps {
  compact?: boolean;
  variant?: "light" | "dark";
}

export function ZKLoginButton({ compact = false, variant = "dark" }: ZKLoginButtonProps) {
  const client = useSuiClient();
  const [address, setAddress] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (typeof window !== "undefined") {
      const addr = sessionStorage.getItem("zk_address");
      if (addr) setAddress(addr);
    }
  }, []);

  const handleLogout = useCallback(() => {
    setAddress(null);
    if (typeof window !== "undefined") {
      sessionStorage.removeItem("zk_address");
      sessionStorage.removeItem("zk_ephemeral_key");
      sessionStorage.removeItem("zk_proof");
      sessionStorage.removeItem("zk_jwt");
      sessionStorage.removeItem("zk_max_epoch");
      sessionStorage.removeItem("zk_randomness");
      window.dispatchEvent(new CustomEvent("zk-logout"));
    }
  }, []);

  const startZKLogin = useCallback(() => {
    const clientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;
    if (!clientId) {
      setError(
        "Missing NEXT_PUBLIC_GOOGLE_CLIENT_ID. Add it to .env.local for ZK-Login."
      );
      return;
    }

    setLoading(true);
    setError(null);

    (async () => {
      try {
        const { epoch } = await client.getLatestSuiSystemState();
        const maxEpoch = Number(epoch) + 2;
        const ephemeralKeyPair = new Ed25519Keypair();
        const randomness = generateRandomness();
        const nonce = generateNonce(
          ephemeralKeyPair.getPublicKey(),
          maxEpoch,
          randomness
        );

        if (typeof window !== "undefined") {
          sessionStorage.setItem(
            "zk_ephemeral_key",
            ephemeralKeyPair.getSecretKey()
          );
          sessionStorage.setItem("zk_max_epoch", maxEpoch.toString());
          sessionStorage.setItem("zk_randomness", randomness.toString());
        }

        const redirectUri =
          typeof window !== "undefined"
            ? `${window.location.origin}/auth/callback`
            : "";
        const authUrl = new URL("https://accounts.google.com/o/oauth2/v2/auth");
        authUrl.searchParams.set("client_id", clientId);
        authUrl.searchParams.set("redirect_uri", redirectUri);
        authUrl.searchParams.set("response_type", "id_token");
        authUrl.searchParams.set("scope", "openid");
        authUrl.searchParams.set("nonce", nonce);

        window.location.href = authUrl.toString();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to start login");
        setLoading(false);
      }
    })();
  }, [client]);

  if (address) {
    const textClass = variant === "light" ? "text-black/80" : "text-foreground";
    return (
      <div className="flex items-center gap-3">
        <div className={`rounded-xl glass px-4 py-2 flex items-center gap-2 ${variant === "light" ? "border-black/10" : ""}`}>
          <div className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
          <span className={`text-sm font-mono truncate max-w-[140px] ${textClass}`}>
            {address.slice(0, 6)}...{address.slice(-4)}
          </span>
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={handleLogout}
          className={variant === "light" ? "text-black/80 hover:text-black" : ""}
        >
          <LogOut className="h-4 w-4 mr-1" />
          Disconnect
        </Button>
      </div>
    );
  }

  return (
    <div className={compact ? "w-full" : "flex flex-col items-end gap-1"}>
      <Button
        variant={compact ? "ghost" : "glass"}
        onClick={startZKLogin}
        disabled={loading}
        className={
          compact
            ? `w-full justify-center gap-1.5 rounded-none h-10 hover:bg-white/5 font-medium ${
                variant === "light" ? "text-black/80 hover:text-black" : "text-foreground"
              }`
            : variant === "light"
              ? "gap-2 text-black/80 hover:text-black"
              : "gap-2"
        }
      >
        {loading ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <LogIn className="h-4 w-4" />
        )}
        {loading ? "..." : compact ? "ZK Login" : "Sign in with Google (ZK)"}
      </Button>
      {error && !compact && (
        <p className="text-xs text-destructive max-w-[200px] text-right">
          {error}
        </p>
      )}
    </div>
  );
}
