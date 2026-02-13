"use client";

import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import Link from "next/link";
import { Loader2, Users, UserPlus, UserMinus } from "lucide-react";
import { useCommunity } from "@/community/[id]/hooks/useCommunity";
import { useCommunitySubscription } from "@/community/[id]/hooks/useCommunitySubscription";
import { BackButton } from "@/components/BackButton";
import { useSuiClient } from "@mysten/dapp-kit";
import { useCurrentAccount } from "@mysten/dapp-kit";
import { isRawSuiAddress } from "@/lib/sui";
import { useCreatorCommunities, type CommunityInfo } from "@/hooks/useCreatorCommunities";
import { useArtistPageViewer } from "./hooks/useArtistPageViewer";
import { useArtistUnfollow } from "./hooks/useArtistUnfollow";
import { Button } from "@/components/ui/button";
import { ConnectButton } from "@/components/ConnectButton";

/**
 * Creator / Artist profile page
 *
 * Shows artist header with Follow/Unfollow and their communities.
 */
export default function CreatorPage() {
  const params = useParams();
  const rawAddress = params.address as string;
  const [resolvedAddress, setResolvedAddress] = useState<string | null>(null);
  const currentAccount = useCurrentAccount();
  const [zkAddress, setZkAddress] = useState<string | null>(null);
  const viewerAddress = currentAccount?.address ?? zkAddress ?? undefined;

  const suiClient = useSuiClient();

  useEffect(() => {
    if (typeof window !== "undefined") {
      setZkAddress(sessionStorage.getItem("zk_address"));
    }
  }, []);
  useEffect(() => {
    const handleZkLogout = () => setZkAddress(null);
    window.addEventListener("zk-logout", handleZkLogout);
    return () => window.removeEventListener("zk-logout", handleZkLogout);
  }, []);

  useEffect(() => {
    if (!rawAddress) {
      setResolvedAddress(null);
      return;
    }
    if (isRawSuiAddress(rawAddress)) {
      setResolvedAddress(rawAddress);
      return;
    }
    const name = rawAddress.toLowerCase().endsWith(".sui")
      ? rawAddress.toLowerCase()
      : `${rawAddress.toLowerCase()}.sui`;
    suiClient
      .resolveNameServiceAddress({ name })
      .then((addr) => setResolvedAddress(addr ?? rawAddress))
      .catch(() => setResolvedAddress(rawAddress));
  }, [rawAddress, suiClient]);

  const { data, isLoading, error } = useCreatorCommunities(resolvedAddress ?? undefined);
  const firstCommunityId = data?.owned?.[0]?.id;
  const { data: firstCommunity } = useCommunity(firstCommunityId, viewerAddress);
  const { follow, isSubscribing, pendingAction } = useCommunitySubscription(firstCommunityId);
  const { data: viewerData } = useArtistPageViewer(
    viewerAddress,
    resolvedAddress ?? undefined,
    data?.owned ?? []
  );
  const { unfollow, isUnfollowing, error: unfollowError } = useArtistUnfollow();

  const isFollowing = viewerData?.isFollowing ?? false;
  const followPrice =
    firstCommunity?.subscriptionTiers?.length
      ? firstCommunity.subscriptionTiers.find((t) => t.tier === 0)?.priceMist ??
        firstCommunity.subscriptionTiers[0]?.priceMist ??
        BigInt(0)
      : BigInt(0);
  const artistCommunitiesWeFollow = viewerData?.artistCommunitiesWeFollow ?? [];
  const isConnected = !!currentAccount || !!zkAddress;

  return (
    <main className="min-h-screen">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <BackButton label="Back to feed" />

        <div className="glass-light rounded-2xl p-8 border border-white/15">
          {/* Artist header with Follow/Unfollow */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8">
            <div>
              <h1 className="text-xl font-semibold text-foreground mb-1">Artist</h1>
              <p className="text-muted-foreground text-sm font-mono truncate">
                {resolvedAddress ?? rawAddress}
              </p>
            </div>
            {!isLoading && data && (
              <div className="flex flex-col sm:flex-row gap-3">
                {!isConnected ? (
                  <ConnectButton />
                ) : isFollowing ? (
                  <Button
                    variant="outline"
                    size="lg"
                    className="border-red-500/50 text-red-500 hover:bg-red-500/10 hover:border-red-500"
                    disabled={isUnfollowing}
                    onClick={() => unfollow(artistCommunitiesWeFollow)}
                  >
                    {isUnfollowing ? (
                      <>
                        <Loader2 className="h-5 w-5 animate-spin" />
                        Leaving...
                      </>
                    ) : (
                      <>
                        <UserMinus className="h-5 w-5" />
                        Unfollow artist
                      </>
                    )}
                  </Button>
                ) : (
                  data.owned.length > 0 && (
                    <Button
                      variant="default"
                      size="lg"
                      className="bg-blue-800 hover:bg-blue-700 text-white"
                      disabled={isSubscribing}
                      onClick={() => follow(followPrice)}
                    >
                      {isSubscribing && pendingAction === "follow" ? (
                        <>
                          <Loader2 className="h-5 w-5 animate-spin" />
                          Following...
                        </>
                      ) : (
                        <>
                          <UserPlus className="h-5 w-5" />
                          Follow this artist
                          {followPrice > BigInt(0) && (
                            <span className="ml-1.5 opacity-90 text-sm">
                              (
                              {Number(followPrice) / 1e9 >= 0.001
                                ? (Number(followPrice) / 1e9).toFixed(3)
                                : "<0.001"}{" "}
                              SUI)
                            </span>
                          )}
                        </>
                      )}
                    </Button>
                  )
                )}
              </div>
            )}
          </div>
          {unfollowError && (
            <p className="text-destructive text-sm mb-4">{unfollowError}</p>
          )}

          {isLoading && (
            <div className="flex items-center justify-center gap-2 py-12 text-muted-foreground">
              <Loader2 className="h-5 w-5 animate-spin" />
              <span>Loading communities...</span>
            </div>
          )}

          {error && (
            <p className="text-destructive text-sm py-4">
              Failed to load communities. Please try again.
            </p>
          )}

          {!isLoading && !error && data && (
            <CommunitySection
              title="This artist's communities"
              subtitle="Communities created by this artist — join from each community page"
              communities={data.owned}
              icon={<Users className="h-5 w-5" />}
              emptyMessage="No communities created yet."
              communitiesWeFollow={artistCommunitiesWeFollow}
            />
          )}
        </div>
      </div>
    </main>
  );
}

function CommunitySection({
  title,
  subtitle,
  communities,
  icon,
  emptyMessage,
  communitiesWeFollow = [],
}: {
  title: string;
  subtitle: string;
  communities: CommunityInfo[];
  icon: React.ReactNode;
  emptyMessage: string;
  communitiesWeFollow?: { id: string; viewerIsMember?: boolean }[];
}) {
  const followSet = new Set(communitiesWeFollow.map((c) => c.id));
  const memberSet = new Set(
    communitiesWeFollow.filter((c) => c.viewerIsMember).map((c) => c.id)
  );

  return (
    <div>
      <h3 className="text-lg font-semibold text-foreground mb-2 flex items-center gap-2">
        {icon}
        {title}
      </h3>
      <p className="text-muted-foreground text-sm mb-4">{subtitle}</p>
      {communities.length === 0 ? (
        <p className="text-muted-foreground/80 text-sm italic">{emptyMessage}</p>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {communities.map((c) => {
            const weFollow = followSet.has(c.id);
            const weAreMember = memberSet.has(c.id);
            return (
              <Link
                key={c.id}
                href={`/community/${c.id}`}
                className="block rounded-xl bg-background/40 border border-white/10 p-4 hover:border-white/20 transition-colors relative"
              >
                <div className="flex items-start justify-between gap-2">
                  <h4 className="font-medium text-foreground truncate flex-1 min-w-0">
                    {c.name || "Unnamed"}
                  </h4>
                  {(weFollow || weAreMember) && (
                    <span className="shrink-0 inline-flex rounded-md bg-primary/15 px-2 py-0.5 text-xs text-primary">
                      {weAreMember ? "Joined" : "Following"}
                    </span>
                  )}
                </div>
                <p className="text-sm text-muted-foreground line-clamp-2 mt-1">
                  {c.description || "No description"}
                </p>
                <p className="text-xs text-muted-foreground/70 mt-2 font-mono truncate">
                  {c.id.slice(0, 16)}...
                </p>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
