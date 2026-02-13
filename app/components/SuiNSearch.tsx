"use client";

import { useState } from "react";
import { SuiClient, getFullnodeUrl } from "@mysten/sui/client";
import { Search, Loader2, CheckCircle2, XCircle } from "lucide-react";
import { Input } from "./ui/input";
import { Button } from "./ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "./ui/card";
import { cn } from "@/lib/utils";

// SuiNS names are primarily on mainnet - use mainnet for resolution
const suinsClient = new SuiClient({ url: getFullnodeUrl("mainnet") });

export function SuiNSearch() {
  const [query, setQuery] = useState("");
  const [result, setResult] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSearch = async () => {
    if (!query.trim()) return;

    setLoading(true);
    setError(null);
    setResult(null);

    try {
      // Ensure the name has .sui suffix for resolution
      const name = query.trim().toLowerCase().endsWith(".sui")
        ? query.trim().toLowerCase()
        : `${query.trim().toLowerCase()}.sui`;

      const address = await suinsClient.resolveNameServiceAddress({ name });

      if (address) {
        setResult(address);
      } else {
        setError("No address found for this SuiNS name");
      }
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to resolve SuiNS name"
      );
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") handleSearch();
  };

  return (
    <Card className="glass border-white/30 w-full">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Search className="h-5 w-5 text-primary" />
          SuiNS Lookup
        </CardTitle>
        <CardDescription>
          Find wallet addresses by Sui Name Service nickname. Searches mainnet
          (e.g. try &quot;suins&quot; or &quot;sui&quot;).
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex gap-3">
          <Input
            placeholder="Enter nickname (e.g. alice or alice.sui)"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            className="flex-1"
            disabled={loading}
          />
          <Button
            onClick={handleSearch}
            disabled={loading || !query.trim()}
            className="min-w-[100px]"
          >
            {loading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              "Search"
            )}
          </Button>
        </div>

        {result && (
          <div className="rounded-xl bg-emerald-500/10 dark:bg-emerald-500/20 border border-emerald-500/30 p-4 flex items-start gap-3">
            <CheckCircle2 className="h-5 w-5 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
            <div className="min-w-0">
              <p className="text-sm font-medium text-emerald-800 dark:text-emerald-200 mb-1">
                Resolved address
              </p>
              <p
                className={cn(
                  "text-sm font-mono break-all text-foreground/90",
                  "select-all cursor-pointer"
                )}
                title="Click to copy"
                onClick={() => navigator.clipboard.writeText(result)}
              >
                {result}
              </p>
            </div>
          </div>
        )}

        {error && (
          <div className="rounded-xl bg-destructive/10 border border-destructive/30 p-4 flex items-start gap-3">
            <XCircle className="h-5 w-5 text-destructive shrink-0 mt-0.5" />
            <p className="text-sm text-destructive">{error}</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
