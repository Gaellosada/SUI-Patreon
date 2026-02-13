"use client";

import { useParams } from "next/navigation";
import Link from "next/link";
import {
  Loader2,
  Users,
  User,
  UserMinus,
  FileText,
  Lock,
} from "lucide-react";
import { useCurrentAccount } from "@mysten/dapp-kit";
import { useEffect, useState } from "react";
import {
  useCommunity,
  type CommunityDetail,
  type PostInfo,
} from "./hooks/useCommunity";
import { useCommunitySubscription } from "./hooks/useCommunitySubscription";
import { Button } from "@/components/ui/button";
import { ConnectButton } from "@/components/ConnectButton";
import { BackButton } from "@/components/BackButton";

export default function CommunityPage() {
  const params = useParams();
  const communityId = params.id as string;
  const currentAccount = useCurrentAccount();
  const [zkAddress, setZkAddress] = useState<string | null>(null);
  const viewerAddress = currentAccount?.address ?? zkAddress ?? undefined;

  useEffect(() => {
    if (typeof window !== "undefined") {
      setZkAddress(sessionStorage.getItem("zk_address"));
    }
  }, []);

  const { data: community, isLoading, error } = useCommunity(
    communityId,
    viewerAddress
  );
  const { join, leave, isSubscribing, pendingAction } = useCommunitySubscription(communityId);

  if (isLoading || !communityId) {
    return (
      <main className="min-h-screen">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <BackButton label="Back" />
          <div className="flex items-center justify-center gap-2 py-24 text-muted-foreground">
            <Loader2 className="h-6 w-6 animate-spin" />
            <span>Loading community...</span>
          </div>
        </div>
      </main>
    );
  }

  if (error || !community) {
    return (
      <main className="min-h-screen">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <BackButton label="Back" />
          <div className="glass-light rounded-2xl p-8 border border-white/15 text-center">
            <p className="text-destructive text-sm">
              Community not found or failed to load.
            </p>
          </div>
        </div>
      </main>
    );
  }

  const isConnected = !!currentAccount || !!zkAddress;

  return (
    <main className="min-h-screen">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <BackButton label="Back" />

        <CommunityHeader
          community={community}
          isConnected={isConnected}
          isOwner={viewerAddress === community.creator}
          onJoin={join}
          onLeave={leave}
          isSubscribing={isSubscribing}
          pendingAction={pendingAction}
        />

        <CommunityStats community={community} />

        <section className="mt-10">
          <h2 className="text-lg font-semibold text-foreground mb-4 flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Posts
          </h2>
          {community.posts.length === 0 ? (
            <div className="rounded-xl bg-background/40 border border-white/10 p-8 text-center text-muted-foreground text-sm">
              No posts yet.
            </div>
          ) : (
            <div className="space-y-6">
              {community.posts.map((post) => (
                <PostCard key={post.id} post={post} />
              ))}
            </div>
          )}
        </section>
      </div>
    </main>
  );
}

function CommunityHeader({
  community,
  isConnected,
  isOwner,
  onJoin,
  onLeave,
  isSubscribing,
  pendingAction,
}: {
  community: CommunityDetail;
  isConnected: boolean;
  isOwner: boolean;
  onJoin: () => void;
  onLeave: () => void;
  isSubscribing: boolean;
  pendingAction: "follow" | "join" | "leave" | null;
}) {
  const showJoin = !isOwner && !community.viewerIsMember;
  const showLeave = !isOwner && community.viewerIsMember;

  return (
    <div className="glass-light rounded-2xl p-8 border border-white/15">
      <h1 className="text-2xl font-semibold text-foreground mb-2">
        {community.name || "Unnamed community"}
      </h1>
      <p className="text-muted-foreground text-sm mb-6">
        {community.description || "No description"}
      </p>

      {!isConnected ? (
        <div className="flex flex-col sm:flex-row gap-4 items-start">
          <ConnectButton />
          <p className="text-sm text-muted-foreground">
            Connect wallet to join this community
          </p>
        </div>
      ) : (
        <div className="flex flex-wrap gap-3">
          {showJoin && (
            <Button
              variant="outline"
              size="lg"
              className="border-white/20"
              disabled={isSubscribing}
              onClick={onJoin}
            >
              {isSubscribing && pendingAction === "join" ? (
                <>
                  <Loader2 className="h-5 w-5 animate-spin" />
                  Joining...
                </>
              ) : (
                <>
                  <Users className="h-5 w-5" />
                  Join community
                </>
              )}
            </Button>
          )}
          {community.viewerIsMember && (
            <span className="inline-flex items-center gap-2 rounded-lg bg-primary/15 px-3 py-2 text-sm text-primary">
              <Users className="h-4 w-4" />
              Joined
            </span>
          )}
          {showLeave && (
            <Button
              variant="outline"
              size="lg"
              className="border-red-500/50 text-red-500 hover:bg-red-500/10 hover:border-red-500"
              disabled={isSubscribing}
              onClick={onLeave}
            >
              {isSubscribing && pendingAction === "leave" ? (
                <>
                  <Loader2 className="h-5 w-5 animate-spin" />
                  Leaving...
                </>
              ) : (
                <>
                  <UserMinus className="h-5 w-5" />
                  Leave community
                </>
              )}
            </Button>
          )}
        </div>
      )}
    </div>
  );
}


function CommunityStats({ community }: { community: CommunityDetail }) {
  return (
    <div className="mt-6 grid grid-cols-2 gap-4">
      <div className="rounded-xl bg-background/40 border border-white/10 p-4">
        <div className="flex items-center gap-2 text-muted-foreground text-sm mb-1">
          <User className="h-4 w-4" />
          Owner
        </div>
        <Link
          href={`/creator/${community.creator}`}
          className="font-mono text-sm text-foreground hover:text-primary truncate block"
        >
          {community.creator.slice(0, 8)}...{community.creator.slice(-6)}
        </Link>
      </div>
      <div className="rounded-xl bg-background/40 border border-white/10 p-4">
        <div className="flex items-center gap-2 text-muted-foreground text-sm mb-1">
          <Users className="h-4 w-4" />
          Members
        </div>
        <p className="font-medium text-foreground">{community.memberCount}</p>
      </div>
    </div>
  );
}

function PostCard({ post }: { post: PostInfo }) {
  const isTierGated = post.contentKey.length > 0;
  const dateStr = post.timestampMs
    ? new Date(post.timestampMs).toLocaleDateString()
    : "";

  return (
    <div className="rounded-xl bg-background/40 border border-white/10 p-5">
      <div className="flex items-center justify-between gap-4 mb-3">
        <p className="font-mono text-xs text-muted-foreground truncate">
          {post.author.slice(0, 8)}...{post.author.slice(-6)}
        </p>
        {dateStr && (
          <span className="text-xs text-muted-foreground shrink-0">
            {dateStr}
          </span>
        )}
      </div>

      {isTierGated ? (
        <div className="flex items-center gap-2 py-4 rounded-lg bg-primary/10 border border-primary/20">
          <Lock className="h-5 w-5 text-primary shrink-0" />
          <p className="text-sm text-muted-foreground">
            Exclusive content — follow to unlock
          </p>
        </div>
      ) : post.content ? (
        <p className="text-foreground text-sm whitespace-pre-wrap break-words">
          {post.content}
        </p>
      ) : (
        <p className="text-muted-foreground text-sm italic">Empty post</p>
      )}

      {post.likeCount > 0 && (
        <p className="text-xs text-muted-foreground mt-3">
          {post.likeCount} like{post.likeCount !== 1 ? "s" : ""}
        </p>
      )}
    </div>
  );
}
