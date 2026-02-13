"use client";

import { useState } from "react";
import Link from "next/link";
import { Users, Loader2 } from "lucide-react";
import {
  useSignAndExecuteTransaction,
  useSuiClient,
  useSuiClientQuery,
} from "@mysten/dapp-kit";
import { Transaction } from "@mysten/sui/transactions";
import { normalizeSuiObjectId } from "@mysten/sui/utils";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { ConnectButton } from "../components/ConnectButton";
import { ConnectWalletToInteract } from "../components/ConnectWalletToInteract";
import { BackButton } from "../components/BackButton";
import { useNetworkVariable } from "../networkConfig";
import { useConnection } from "../hooks/useConnection";
import { useSuiClientContext } from "@mysten/dapp-kit";

// Must match deployed contract: MIN_CREATION_FEE_MIST in community.move
// If you redeployed with 1_000_000, change this to 1_000_000
const MIN_CREATION_FEE_MIST = 100_000_000; // 0.1 SUI

export default function CreateCommunityPage() {
  const { address: ownerAddress, isConnected, canSignTransactions } = useConnection();
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [artistDescription, setArtistDescription] = useState("");
  const [followPriceSui, setFollowPriceSui] = useState("0.001");

  const packageId = useNetworkVariable("artistPackageId");
  const { network } = useSuiClientContext();

  const { data: ownedObjects } = useSuiClientQuery(
    "getOwnedObjects",
    {
      owner: ownerAddress ?? "",
      options: { showContent: true, showType: true },
    },
    { enabled: !!ownerAddress && !!packageId }
  );

  const norm = (s: string) => s?.toLowerCase().replace(/^0x0+/, "0x") ?? "";
  const pkgNorm = norm(packageId ?? "");
  const getObjType = (o: unknown) =>
    norm((o as { data?: { type?: string; content?: { type?: string } } })?.data?.type ?? ((o as { data?: { content?: { type?: string } } })?.data?.content as { type?: string })?.type ?? "");

  const isFromOurPackage = (type: string) => type.startsWith(pkgNorm + "::artist::");
  const isArtistCap = (type: string) =>
    type.includes("artistcap") && !type.includes("artistcommunities");
  const isArtistCommunities = (type: string) => type.includes("artistcommunities");

  const artistCapId =
    ownedObjects?.data?.find((o) => {
      if (o.data?.content?.dataType !== "moveObject") return false;
      const t = getObjType(o);
      return isFromOurPackage(t) && isArtistCap(t);
    })?.data?.objectId ?? null;

  const artistCommunitiesId =
    ownedObjects?.data?.find((o) => {
      if (o.data?.content?.dataType !== "moveObject") return false;
      const t = getObjType(o);
      return isFromOurPackage(t) && isArtistCommunities(t);
    })?.data?.objectId ?? null;

  const isArtist = !!artistCapId && !!artistCommunitiesId;

  const { mutate: signAndExecute, isPending } =
    useSignAndExecuteTransaction();
  const suiClient = useSuiClient();
  const hasPackageId = !!packageId?.trim();

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!hasPackageId) {
      setError("Package not configured. Set NEXT_PUBLIC_ARTIST_PACKAGE_ID.");
      return;
    }
    if (!isArtist || !artistCapId || !artistCommunitiesId) {
      setError("You must be a registered artist to create a community.");
      return;
    }
    if (!name.trim()) {
      setError("Community name is required.");
      return;
    }

    const priceSui = parseFloat(followPriceSui) || 0;
    const priceMist = Math.round(priceSui * 1e9);
    if (priceMist < 0) {
      setError("Follow price cannot be negative.");
      return;
    }

    const tx = new Transaction();
    tx.setGasBudget(150_000_000);
    const [creationFee, initialTreasury] = tx.splitCoins(tx.gas, [
      BigInt(MIN_CREATION_FEE_MIST),
      BigInt(1),
    ]);

    const capIdNorm = normalizeSuiObjectId(artistCapId);
    const communitiesIdNorm = normalizeSuiObjectId(artistCommunitiesId);

    tx.moveCall({
      target: `${packageId}::community::create_community_as_artist`,
      arguments: [
        tx.object(capIdNorm),
        tx.object(communitiesIdNorm),
        creationFee,
        tx.pure.string(name.trim()),
        tx.pure.string(description.trim()),
        tx.pure.string(artistDescription.trim()),
        tx.pure.string(""),
        initialTreasury,
        tx.pure.vector("u64", [priceMist]), // single follow price (tier 0)
      ],
    });

    signAndExecute(
      { transaction: tx },
      {
        onSuccess: async ({ digest }) => {
          await suiClient.waitForTransaction({ digest });
          setSuccess(true);
        },
        onError: (err) => {
          let msg = err.message ?? "Transaction failed";
          if (
            msg.includes("signTransactionBlock") ||
            msg.includes("No wallet") ||
            msg.includes("wallet") ||
            msg.includes("sign")
          ) {
            setError(
              "Connect a wallet (Sui Wallet, Ethos) to sign. ZK Login cannot sign transactions. If using a wallet, try updating it to the latest version."
            );
          } else if (msg.includes("TypeMismatch") || msg.includes("CommandArgumentError")) {
            setError(
              msg + " — Ensure NEXT_PUBLIC_ARTIST_PACKAGE_ID matches your deployed package. If you redeployed, re-register as artist to get new caps."
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
              <Users className="h-8 w-8" />
            </div>
            <h1 className="text-2xl font-semibold text-foreground mb-2">
              Community created!
            </h1>
            <p className="text-muted-foreground mb-8 max-w-md mx-auto">
              Your community is live. Members can now join and engage with your
              content.
            </p>
            <Link href="/">
              <Button variant="default" size="lg" className="bg-blue-800 hover:bg-blue-700 text-white">
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
              <Users className="h-7 w-7 text-primary" />
            </div>
            <h1 className="text-2xl font-semibold text-foreground mb-2">
              Create a Community
            </h1>
            <p className="text-muted-foreground text-sm max-w-md mx-auto">
              As an artist, create a community where your audience can join,
              follow, and engage with your content. Creation fee: 0.1 SUI.
            </p>
          </div>

          {!isConnected ? (
            <div className="rounded-xl glass-subtle border border-white/10 p-6 text-center">
              <p className="text-sm text-muted-foreground mb-4">
                Connect to create a community
              </p>
              <ConnectButton />
            </div>
          ) : !canSignTransactions ? (
            <ConnectWalletToInteract action="create communities" />
          ) : !isArtist ? (
            <div className="rounded-xl glass-subtle border border-white/10 p-6 text-center">
              <p className="text-sm text-muted-foreground mb-4">
                Only registered artists can create communities. Become an artist
                first.
              </p>
              <Link href="/become-artist">
                <Button
                  variant="default"
                  size="lg"
                  className="bg-blue-800 hover:bg-blue-700 text-white"
                >
                  Become Artist
                </Button>
              </Link>
            </div>
          ) : (
            <form onSubmit={handleCreate} className="space-y-6">
              <div>
                <label className="block text-sm font-medium text-foreground mb-2">
                  Community name *
                </label>
                <Input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="My Awesome Community"
                  maxLength={100}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-foreground mb-2">
                  Description
                </label>
                <Input
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="What is this community about?"
                  maxLength={500}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-foreground mb-2">
                  Artist bio
                </label>
                <Input
                  value={artistDescription}
                  onChange={(e) => setArtistDescription(e.target.value)}
                  placeholder="Tell your audience about yourself"
                  maxLength={300}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-foreground mb-2">
                  Follow price (SUI)
                </label>
                <Input
                  type="number"
                  step="0.001"
                  min="0"
                  value={followPriceSui}
                  onChange={(e) => setFollowPriceSui(e.target.value)}
                  placeholder="0.001"
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Price to follow this community. Use 0 for free.
                </p>
              </div>

              <div className="rounded-xl bg-background/40 border border-white/10 p-4">
                <div className="flex justify-between items-center">
                  <span className="text-sm text-muted-foreground">
                    Creation fee
                  </span>
                  <span className="font-medium text-foreground">0.1 SUI</span>
                </div>
              </div>

              {network !== "testnet" && (
                <div className="rounded-xl bg-amber-500/15 border border-amber-500/30 p-4 mb-4">
                  <p className="text-sm text-amber-700 dark:text-amber-400">
                    Your wallet is on <strong>{network}</strong>. The package is deployed on testnet. Switch your wallet to testnet to create communities.
                  </p>
                </div>
              )}
              {error && (
                <div className="rounded-xl bg-destructive/15 border border-destructive/30 p-4">
                  <p className="text-sm text-destructive">{error}</p>
                </div>
              )}

              <Button
                type="submit"
                variant="default"
                size="lg"
                className="w-full bg-blue-800 hover:bg-blue-700 text-white"
                disabled={isPending || !hasPackageId}
              >
                {isPending ? (
                  <>
                    <Loader2 className="h-5 w-5 animate-spin" />
                    Creating...
                  </>
                ) : (
                  "Create Community"
                )}
              </Button>
            </form>
          )}
        </div>
      </div>
    </main>
  );
}
