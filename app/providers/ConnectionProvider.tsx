"use client";

import {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
} from "react";
import { useCurrentAccount, useCurrentWallet } from "@mysten/dapp-kit";

function getZkAddressFromStorage(): string | null {
  if (typeof window === "undefined") return null;
  return sessionStorage.getItem("zk_address");
}

type ConnectionContextValue = {
  address: string | undefined;
  isConnected: boolean;
  canSignTransactions: boolean;
  refreshConnection: () => void;
};

const ConnectionContext = createContext<ConnectionContextValue | null>(null);

export function ConnectionProvider({ children }: { children: React.ReactNode }) {
  const currentAccount = useCurrentAccount();
  const { currentWallet } = useCurrentWallet();
  const [zkAddress, setZkAddress] = useState<string | null>(
    () => getZkAddressFromStorage()
  );

  const refreshConnection = useCallback(() => {
    setZkAddress(getZkAddressFromStorage());
  }, []);

  useEffect(() => {
    setZkAddress(getZkAddressFromStorage());
  }, []);

  useEffect(() => {
    const handleZkLogout = () => setZkAddress(null);
    window.addEventListener("zk-logout", handleZkLogout);
    return () => window.removeEventListener("zk-logout", handleZkLogout);
  }, []);

  const walletAddress = currentAccount?.address;
  const address = walletAddress ?? zkAddress ?? undefined;

  const value: ConnectionContextValue = {
    address,
    isConnected: !!address,
    canSignTransactions: !!currentWallet && !!currentAccount,
    refreshConnection,
  };

  return (
    <ConnectionContext.Provider value={value}>
      {children}
    </ConnectionContext.Provider>
  );
}

export function useConnection() {
  const ctx = useContext(ConnectionContext);
  if (!ctx) {
    throw new Error("useConnection must be used within ConnectionProvider");
  }
  return ctx;
}
