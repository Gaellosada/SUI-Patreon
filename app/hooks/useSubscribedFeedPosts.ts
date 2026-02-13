"use client";

import { useQuery } from "@tanstack/react-query";
import { useSuiClient } from "@mysten/dapp-kit";
import { useNetworkVariable } from "@/networkConfig";
import { useCreatorCommunities } from "./useCreatorCommunities";
import { fetchCommunityDetail } from "@/community/[id]/hooks/useCommunity";
import type { FeedPostProps } from "@/components/FeedPost";

const PACKAGE_ID = process.env.NEXT_PUBLIC_ARTIST_PACKAGE_ID ?? "";

function formatTimestamp(ms: number): string {
  if (!ms) return "";
  const d = new Date(ms);
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return d.toLocaleDateString();
}

function shortenAddress(addr: string): string {
  if (!addr || addr.length < 12) return addr;
  return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
}

export type SubscribedFeedPost = FeedPostProps & {
  communityId: string;
  communityName: string;
};

export function useSubscribedFeedPosts(viewerAddress: string | undefined) {
  const suiClient = useSuiClient();
  const packageId = useNetworkVariable("artistPackageId") ?? PACKAGE_ID;

  const { data: creatorData } = useCreatorCommunities(viewerAddress);
  const subscribedCommunities = creatorData?.subscribed ?? [];

  return useQuery({
    queryKey: ["subscribed-feed", viewerAddress, packageId, subscribedCommunities.map((c) => c.id).join(",")],
    queryFn: async (): Promise<SubscribedFeedPost[]> => {
      if (!viewerAddress || !packageId || !subscribedCommunities.length) {
        return [];
      }

      const communitiesWithPosts = await Promise.all(
        subscribedCommunities.map((c) =>
          fetchCommunityDetail(suiClient, c.id, packageId, viewerAddress)
        )
      );

      const posts: SubscribedFeedPost[] = [];
      for (let i = 0; i < communitiesWithPosts.length; i++) {
        const community = communitiesWithPosts[i];
        const communityInfo = subscribedCommunities[i];
        if (!community?.posts?.length) continue;

        for (const post of community.posts) {
          const isTierGated = post.contentKey && post.contentKey.length > 0;
          const content = isTierGated
            ? "Exclusive tier-gated content — subscribe to unlock"
            : (post.content || "Empty post");

          posts.push({
            id: post.id,
            author: community.name || "Community",
            authorHandle: shortenAddress(community.creator),
            content,
            likes: post.likeCount,
            comments: [],
            timestamp: formatTimestamp(post.timestampMs),
            communityId: community.id,
            communityName: community.name,
          });
        }
      }

      return posts.sort((a, b) => {
        const communityA = communitiesWithPosts.find((c) => c?.id === a.communityId);
        const communityB = communitiesWithPosts.find((c) => c?.id === b.communityId);
        const postA = communityA?.posts.find((p) => p.id === a.id);
        const postB = communityB?.posts.find((p) => p.id === b.id);
        const tsA = postA?.timestampMs ?? 0;
        const tsB = postB?.timestampMs ?? 0;
        return tsB - tsA;
      });
    },
    enabled:
      !!viewerAddress &&
      !!packageId &&
      subscribedCommunities.length > 0,
  });
}
