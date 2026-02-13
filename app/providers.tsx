"use client";

import { SuiClientProvider, WalletProvider } from "@mysten/dapp-kit";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { networkConfig } from "./networkConfig";
import { useState } from "react";
import { ConnectionProvider } from "./providers/ConnectionProvider";

export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(() => new QueryClient());

  return (
    <QueryClientProvider client={queryClient}>
      <SuiClientProvider networks={networkConfig} defaultNetwork="testnet">
        <WalletProvider autoConnect>
          <ConnectionProvider>{children}</ConnectionProvider>
        </WalletProvider>
      </SuiClientProvider>
    </QueryClientProvider>
  );
}
