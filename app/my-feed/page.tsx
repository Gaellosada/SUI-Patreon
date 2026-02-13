"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { SuiNSearchBar } from "../components/SuiNSearchBar";
import { MyFeedPost } from "../components/MyFeedPost";
import { MyFeedPoll } from "../components/MyFeedPoll";
import { ConnectButton } from "../components/ConnectButton";
import { useConnection } from "../hooks/useConnection";
import { useMyFeed } from "../hooks/useMyFeed";
import { useCurrentAccount } from "@mysten/dapp-kit";
import { Loader2, Users } from "lucide-react";

export default function MyFeedPage() {
  const { address, isConnected, canSignTransactions } = useConnection();
  const currentAccount = useCurrentAccount();
  const [zkAddress, setZkAddress] = useState<string | null>(null);
  const viewerAddress = currentAccount?.address ?? address ?? zkAddress ?? undefined;

  useEffect(() => {
    if (typeof window !== "undefined") {
      setZkAddress(sessionStorage.getItem("zk_address"));
    }
  }, []);

  const { data: feedItems = [], isLoading } = useMyFeed(viewerAddress);

  return (
    <main className="min-h-screen">
      <div
        className="w-full px-4 sm:px-6 lg:px-8 py-16 md:py-24"
        style={{
          background:
            "linear-gradient(to bottom, #0f172a 0%, #0e2035 25%, #0d2438 50%, #0b2d45 75%, #0c4a6e 100%)",
        }}
      >
        <div className="max-w-3xl mx-auto">
          <h1 className="text-3xl md:text-4xl font-bold text-white text-center mb-4">
            My feed
          </h1>
          <p className="text-muted-foreground text-center mb-12">
            Posts from communities you follow
          </p>

          {/* Search bar */}
          <div className="mb-12">
            <SuiNSearchBar isConnected={isConnected} />
          </div>

          {!isConnected ? (
            <div className="rounded-2xl glass-light border border-white/15 p-12 text-center">
              <p className="text-muted-foreground mb-6">
                Connect your wallet to see your personalized feed
              </p>
              <ConnectButton variant="dark" />
            </div>
          ) : isLoading ? (
            <div className="flex items-center justify-center gap-2 py-24 text-muted-foreground">
              <Loader2 className="h-6 w-6 animate-spin" />
              <span>Loading your feed...</span>
            </div>
          ) : feedItems.length === 0 ? (
            <div className="rounded-2xl glass-light border border-white/15 p-12 text-center">
              <Users className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <p className="text-muted-foreground mb-2">
                No posts yet. Follow communities to see their posts here.
              </p>
              <Link
                href="/"
                className="text-primary hover:underline text-sm"
              >
                Explore communities
              </Link>
            </div>
          ) : (
            <div className="space-y-6">
              {feedItems.map((item, i) =>
                item.type === "post" ? (
                  <MyFeedPost
                    key={`post-${item.data.communityId}-${item.data.postId}`}
                    post={item.data}
                    viewerAddress={viewerAddress}
                    canSign={canSignTransactions}
                    index={i}
                  />
                ) : (
                  <MyFeedPoll
                    key={`poll-${item.data.communityId}-${item.data.pollId}`}
                    poll={item.data}
                    viewerAddress={viewerAddress}
                    canSign={canSignTransactions}
                    index={i}
                  />
                )
              )}
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
