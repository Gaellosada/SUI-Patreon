"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { Sparkles, Loader2 } from "lucide-react";
import {
  useSignAndExecuteTransaction,
  useSuiClient,
} from "@mysten/dapp-kit";
import { ConnectButton as DappConnectButton } from "@mysten/dapp-kit";
import { Transaction } from "@mysten/sui/transactions";
import { Button } from "../components/ui/button";
import { ConnectButton } from "../components/ConnectButton";
import { ConnectWalletToInteract } from "../components/ConnectWalletToInteract";
import { BackButton } from "../components/BackButton";
import { useNetworkVariable } from "../networkConfig";
import { useConnection } from "../hooks/useConnection";

const ARTIST_REGISTRATION_FEE_MIST = 1_000_000; // 0.001 SUI

export default function BecomeArtistPage() {
  const { isConnected, canSignTransactions, refreshConnection } = useConnection();
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    refreshConnection();
  }, [refreshConnection]);
  const [error, setError] = useState<string | null>(null);

  const artistPackageId = useNetworkVariable("artistPackageId");
  const artistFeeRecipient = useNetworkVariable("artistFeeRecipient");

  const { mutate: signAndExecute, isPending } =
    useSignAndExecuteTransaction();
  const suiClient = useSuiClient();
  const hasPackageId = !!artistPackageId?.trim();
  const usePaidRegistration = hasPackageId && !!artistFeeRecipient?.trim();

  const handleRegister = () => {
    setError(null);
    if (!hasPackageId) {
      setError(
        "Artist registration is not configured. Deploy the Move package and set NEXT_PUBLIC_ARTIST_PACKAGE_ID in .env"
      );
      return;
    }

    const tx = new Transaction();

  
    const [feeCoin] = tx.splitCoins(tx.gas, [
      BigInt(ARTIST_REGISTRATION_FEE_MIST),
    ]);
    tx.moveCall({
      target: `${artistPackageId}::artist::register_as_artist_with_fee`,
      arguments: [feeCoin, tx.pure.address(artistFeeRecipient!)],
    });
    

    signAndExecute(
      { transaction: tx },
      {
        onSuccess: async ({ digest }) => {
          await suiClient.waitForTransaction({ digest });
          setSuccess(true);
        },
        onError: (err) => {
          const msg = err.message ?? "Transaction failed";
          if (msg.includes("No wallet") || msg.includes("wallet")) {
            setError(
              "Connect a wallet (Sui Wallet, Ethos) to sign. ZK Login cannot sign transactions."
            );
          } else {
            setError(msg);
          }
        },
      }
    );
  };

  if (success) {
    return (
      <main className="min-h-screen">
        <div className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
          <BackButton label="Back to feed" />

          <div className="glass-light rounded-2xl p-8 md:p-12 border border-white/15 text-center animate-feed-in">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-primary/20 text-primary mb-6">
              <Sparkles className="h-8 w-8" />
            </div>
            <h1 className="text-2xl font-semibold text-foreground mb-2">
              You&apos;re now an artist!
            </h1>
            <p className="text-muted-foreground mb-8 max-w-md mx-auto">
              You can now create communities, post content, and build your
              audience on SUI Patreon.
            </p>
            <Link href="/">
              <Button variant="default" size="lg">
                Go to feed
              </Button>
            </Link>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen">
      <div className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <BackButton label="Back to feed" />

        <div className="glass-light rounded-2xl p-8 md:p-12 border border-white/15 animate-feed-in">
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center w-14 h-14 rounded-xl glass border border-white/15 mb-4">
              <Sparkles className="h-7 w-7 text-primary" />
            </div>
            <h1 className="text-2xl font-semibold text-foreground mb-2">
              Become an Artist
            </h1>
            <p className="text-muted-foreground text-sm max-w-md mx-auto">
              Register as an artist to create communities, post content, and
              engage with your audience. A one-time registration fee of 0.001 SUI
              applies.
            </p>
          </div>

          <div className="space-y-6">
            <div className="rounded-xl bg-background/40 border border-white/10 p-4">
              <div className="flex justify-between items-center">
                <span className="text-sm text-muted-foreground">
                  Registration fee
                </span>
                <span className="font-medium text-foreground">
                  {usePaidRegistration ? "0.001 SUI" : "Free (test mode)"}
                </span>
              </div>
            </div>

            {error && (
              <div className="rounded-xl bg-destructive/15 border border-destructive/30 p-4">
                <p className="text-sm text-destructive mb-3">{error}</p>
                {error.includes("Connect a wallet") && (
                  <div className="[&_button]:rounded-lg [&_button]:text-sm">
                    <DappConnectButton connectText="Connect Wallet" />
                  </div>
                )}
              </div>
            )}

            {!isConnected ? (
              <div className="rounded-xl glass-subtle border border-white/10 p-6 text-center">
                <p className="text-sm text-muted-foreground mb-4">
                  Connect to register as an artist
                </p>
                <ConnectButton />
              </div>
            ) : !canSignTransactions ? (
              <ConnectWalletToInteract action="register as an artist" />
            ) : (
              <Button
                variant="default"
                size="lg"
                className="w-full bg-blue-800 hover:bg-blue-700 text-white"
                onClick={handleRegister}
                disabled={isPending || !hasPackageId}
              >
                {isPending ? (
                  <>
                    <Loader2 className="h-5 w-5 animate-spin" />
                    Processing...
                  </>
                ) : !hasPackageId ? (
                  "Deploy package first"
                ) : usePaidRegistration ? (
                  <>
                    Become Artist
                  </>
                ) : (
                  <>
                    Become Artist (Free)
                  </>
                )}
              </Button>
            )}
          </div>

          <p className="text-xs text-muted-foreground text-center mt-6">
            Registration is one-time per wallet. You&apos;ll receive an
            ArtistCap and ArtistCommunities object to manage your content.
          </p>
        </div>
      </div>
    </main>
  );
}
