"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { SuiClient, getFullnodeUrl } from "@mysten/sui/client";
import { Search, Loader2, CheckCircle2, XCircle, ExternalLink } from "lucide-react";
import { Input } from "./ui/input";
import { Button } from "./ui/button";
import { ConnectOverlay } from "./ConnectOverlay";
import { isRawSuiAddress } from "@/lib/sui";
import { cn } from "@/lib/utils";

const suinsClient = new SuiClient({ url: getFullnodeUrl("mainnet") });

export interface SuiNSearchBarProps {
  isConnected?: boolean;
}

export function SuiNSearchBar({ isConnected = false }: SuiNSearchBarProps) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [result, setResult] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showConnectOverlay, setShowConnectOverlay] = useState(false);
  const [pendingViewAddress, setPendingViewAddress] = useState<string | null>(null);

  const handleSearch = async () => {
    if (!query.trim()) return;

    setLoading(true);
    setError(null);
    setResult(null);

    const trimmed = query.trim();

    try {
      // Raw wallet address - use directly
      if (isRawSuiAddress(trimmed)) {
        setResult(trimmed);
        setLoading(false);
        return;
      }

      // SuiNS name - resolve
      const name = trimmed.toLowerCase().endsWith(".sui")
        ? trimmed.toLowerCase()
        : `${trimmed.toLowerCase()}.sui`;

      const address = await suinsClient.resolveNameServiceAddress({ name });

      if (address) {
        setResult(address);
      } else {
        setError("No address found");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to resolve");
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") handleSearch();
  };

  const handleViewClick = () => {
    if (!result) return;

    if (isConnected) {
      router.push(`/creator/${encodeURIComponent(result)}`);
    } else {
      setPendingViewAddress(result);
      setShowConnectOverlay(true);
      // Persist so we can redirect after ZK Login (full page reload)
      if (typeof window !== "undefined") {
        sessionStorage.setItem("pending_view_address", result);
      }
    }
  };

  const closeOverlay = () => {
    setShowConnectOverlay(false);
    setPendingViewAddress(null);
    if (typeof window !== "undefined") {
      sessionStorage.removeItem("pending_view_address");
    }
  };

  // When user connects, navigate to the pending profile (works for both wallet connect and ZK Login after reload)
  useEffect(() => {
    if (!isConnected) return;

    const stored = typeof window !== "undefined" ? sessionStorage.getItem("pending_view_address") : null;
    const address = pendingViewAddress || stored;

    if (address) {
      if (typeof window !== "undefined") {
        sessionStorage.removeItem("pending_view_address");
      }
      setPendingViewAddress(null);
      setShowConnectOverlay(false);
      router.push(`/creator/${encodeURIComponent(address)}`);
    }
  }, [isConnected, pendingViewAddress, router]);

  return (
    <div className="w-full max-w-2xl mx-auto">
      <div className="glass-light rounded-2xl p-3 flex gap-2 items-center border border-white/15 transition-all duration-200">
        <Search className="h-5 w-5 text-primary/80 shrink-0" />
        <Input
          placeholder="SuiNS name or wallet address (e.g. nautilus or 0x...)"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={handleKeyDown}
          className="flex-1 border-0 bg-transparent focus-visible:ring-0 shadow-none"
          disabled={loading}
        />
        <Button
          onClick={handleSearch}
          disabled={loading || !query.trim()}
          size="sm"
          className="shrink-0 hover-lift"
        >
          {loading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            "Lookup"
          )}
        </Button>
      </div>
      {(result || error) && (
        <div
          className={cn(
            "mt-2 rounded-xl p-3 flex items-center gap-2 animate-feed-slide glass-light",
            result
              ? "border border-emerald-500/30"
              : "border border-destructive/30"
          )}
        >
          {result ? (
            <>
              <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0" />
              <p
                className="text-sm font-mono truncate flex-1 cursor-pointer"
                onClick={() => navigator.clipboard.writeText(result)}
                title="Click to copy"
              >
                {result}
              </p>
              <Button
                size="sm"
                variant="ghost"
                className="shrink-0 gap-1.5 hover:bg-white/10"
                onClick={handleViewClick}
              >
                <ExternalLink className="h-4 w-4" />
                View
              </Button>
            </>
          ) : (
            <>
              <XCircle className="h-4 w-4 text-destructive shrink-0" />
              <p className="text-sm text-destructive">{error}</p>
            </>
          )}
        </div>
      )}

      <ConnectOverlay
        open={showConnectOverlay}
        onClose={closeOverlay}
      >
        <p className="text-foreground font-medium text-center pr-8">
          Connect to view profile
        </p>
      </ConnectOverlay>
    </div>
  );
}
