"use client";

import { useEffect, useState } from "react";
import { useCurrentAccount } from "@mysten/dapp-kit";
import { ConnectButton as DappConnectButton } from "@mysten/dapp-kit";
import { ZKLoginButton } from "./ZKLoginButton";

function getZkAddress(): string | null {
  if (typeof window === "undefined") return null;
  return sessionStorage.getItem("zk_address");
}

export function ConnectButton({ variant = "dark" }: { variant?: "light" | "dark" }) {
  const currentAccount = useCurrentAccount();
  const [zkAddress, setZkAddress] = useState<string | null>(getZkAddress);
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    setZkAddress(getZkAddress());
  }, []);

  useEffect(() => {
    const handleZkLogout = () => setZkAddress(null);
    window.addEventListener("zk-logout", handleZkLogout);
    return () => window.removeEventListener("zk-logout", handleZkLogout);
  }, []);

  if (currentAccount) {
    return (
      <div className="hover-lift transition-transform">
        <DappConnectButton connectText="Wallet" />
      </div>
    );
  }

  if (zkAddress && !currentAccount) {
    return (
      <div className="flex items-center gap-2">
        <ZKLoginButton variant={variant} />
        <div className="h-4 w-px bg-white/20" aria-hidden />
        <DappConnectButton connectText="Connect wallet" />
      </div>
    );
  }

  if (zkAddress && currentAccount) {
    return (
      <div className="hover-lift transition-transform">
        <DappConnectButton connectText="Wallet" />
      </div>
    );
  }

  const isLight = variant === "light";
  const buttonClass =
    "flex-1 px-4 py-2.5 text-sm font-medium transition-colors hover-lift hover-glow " +
    (isLight ? "text-black/80 hover:text-black" : "text-foreground");
  const containerClass =
    "flex items-stretch overflow-hidden rounded-xl transition-all duration-300 ease-out " +
    (isLight
      ? "bg-white/40 border border-black/10"
      : "glass-light border border-white/15") +
    " " +
    (expanded ? "w-[280px]" : "w-[120px]");

  return (
    <div
      className="relative flex items-center"
      onMouseEnter={() => setExpanded(true)}
      onMouseLeave={() => setExpanded(false)}
    >
      <div className={containerClass}>
        {!expanded ? (
          <button
            type="button"
            className={"flex-1 " + buttonClass}
          >
            Connect
          </button>
        ) : (
          <>
            <div
              className={
                "flex-1 min-w-0 border-r " +
                (isLight ? "border-black/10" : "border-white/10")
              }
            >
              <ZKLoginButton compact variant={variant} />
              <p className="text-[10px] text-center mt-0.5 opacity-70">
                Browse
              </p>
            </div>
            <div
              className={
                "flex-1 min-w-0 [&_button]:w-full [&_button]:justify-center [&_button]:rounded-none [&_button]:h-10 [&_button]:bg-transparent [&_button]:hover:bg-white/5 [&_button]:shadow-none [&_button]:font-medium " +
                (isLight
                  ? "[&_button]:text-black/80 [&_button]:hover:text-black"
                  : "[&_button]:text-foreground")
              }
            >
              <DappConnectButton connectText="Wallet" />
              <p className="text-[10px] text-center mt-0.5 opacity-70">
                Create & sign
              </p>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
