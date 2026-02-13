"use client";

import { useQuery } from "@tanstack/react-query";
import { useSuiClient } from "@mysten/dapp-kit";
import type { SuiClient } from "@mysten/sui/client";
import { useNetworkVariable } from "@/networkConfig";

const PACKAGE_ID = process.env.NEXT_PUBLIC_ARTIST_PACKAGE_ID ?? "";

export type PostInfo = {
  id: string;
  postId: number;
  author: string;
  contentType: number;
  content: string;
  contentKey: string;
  timestampMs: number;
  likeCount: number;
};

export type TierPrice = {
  tier: number;
  priceMist: bigint;
};

export type CommunityDetail = {
  id: string;
  name: string;
  description: string;
  artistDescription: string;
  image: string;
  creator: string;
  memberCount: number;
  tierRegistryId: string;
  subscriptionTiers: TierPrice[];
  posts: PostInfo[];
  viewerIsMember: boolean;
};

export type ViewerMembership = {
  id: string;
  tier: number;
};

export function useCommunity(communityId: string | undefined, viewerAddress: string | undefined) {
  const suiClient = useSuiClient();
  const packageId = useNetworkVariable("artistPackageId") ?? PACKAGE_ID;

  return useQuery({
    queryKey: ["community", communityId, packageId, viewerAddress],
    queryFn: async (): Promise<CommunityDetail | null> => {
      if (!communityId || !packageId) return null;
      return fetchCommunityDetail(suiClient, communityId, packageId, viewerAddress);
    },
    enabled: !!communityId && !!packageId,
  });
}

export function useViewerMemberships(viewerAddress: string | undefined) {
  const suiClient = useSuiClient();
  const packageId = useNetworkVariable("artistPackageId") ?? PACKAGE_ID;

  return useQuery({
    queryKey: ["viewer-memberships", viewerAddress, packageId],
    queryFn: async (): Promise<ViewerMembership[]> => {
      if (!viewerAddress || !packageId) return [];
      const tierMembershipType = `${packageId}::tier_seal::TierMembership`;
      const { data } = await suiClient.getOwnedObjects({
        owner: viewerAddress,
        filter: { StructType: tierMembershipType },
        options: { showContent: true },
      });
      if (!data?.length) return [];
      return data
        .filter((o) => !!o.data?.content)
        .map((o) => {
          const d = o.data!;
          const fields = (d.content as Record<string, unknown>).fields as Record<string, unknown> | undefined;
          return { id: d.objectId, tier: Number(fields?.tier ?? 0) };
        });
    },
    enabled: !!viewerAddress && !!packageId,
  });
}

export async function fetchCommunityDetail(
  client: SuiClient,
  communityId: string,
  packageId: string,
  _viewerAddress?: string
): Promise<CommunityDetail | null> {
  try {
    const obj = await client.getObject({
      id: communityId,
      options: { showContent: true, showType: true },
    });

    if (!obj.data?.content || !String(obj.data?.type ?? "").includes("Community")) {
      return null;
    }

    const fields = (obj.data.content as Record<string, unknown>).fields as Record<string, unknown>;
    const name = decodeBytes(fields?.name);
    const description = decodeBytes(fields?.description);
    const artistDescription = decodeBytes(fields?.artist_description);
    const image = decodeBytes(fields?.image);
    const creator = String(fields?.creator ?? "");

    const membersTable = fields?.members as Record<string, unknown> | undefined;
    const membersTableId = getTableId(membersTable);
    const membersData = membersTableId
      ? (await client.getDynamicFields({ parentId: membersTableId })).data
      : [];
    const memberCount = membersData.length;
    const viewerIsMember =
      !!_viewerAddress &&
      (creator.toLowerCase() === _viewerAddress.toLowerCase() ||
        membersData.some((df) => {
          const name = df.name as { type?: string; value?: string } | undefined;
          const val = name?.value ?? (typeof df.name === "string" ? df.name : null);
          return val?.toLowerCase() === _viewerAddress.toLowerCase();
        }));

    const tierRegistry = fields?.tier_registry_id;
    const tierRegistryId =
      typeof tierRegistry === "string" ? tierRegistry : (tierRegistry as { id?: string })?.id ?? "";

    const subTiersTable = fields?.subscription_tiers as Record<string, unknown> | undefined;
    const subTiersTableId = getTableId(subTiersTable);
    const subscriptionTiers: TierPrice[] = subTiersTableId
      ? await fetchSubscriptionTiers(client, subTiersTableId)
      : [];

    const postsTable = fields?.posts as Record<string, unknown> | undefined;
    const postsTableId = getTableIdFromObjectTable(postsTable);
    const posts: PostInfo[] = postsTableId
      ? await fetchPosts(client, postsTableId)
      : [];

    return {
      id: communityId,
      name,
      description,
      artistDescription,
      image,
      creator,
      memberCount,
      tierRegistryId,
      subscriptionTiers,
      posts,
      viewerIsMember,
    };
  } catch {
    return null;
  }
}

function decodeBytes(value: unknown): string {
  if (!value) return "";
  if (typeof value === "string") return value;
  const arr = value as number[];
  if (Array.isArray(arr)) {
    return new TextDecoder().decode(new Uint8Array(arr));
  }
  return "";
}

function getTableId(table: Record<string, unknown> | undefined): string | null {
  if (!table) return null;
  const nested = (table.fields as Record<string, unknown>) ?? table;
  const id = table.id ?? nested.id;
  if (typeof id === "string" && id.startsWith("0x")) return id;
  const idObj = id as { id?: string } | undefined;
  return idObj?.id ?? null;
}

function getTableIdFromObjectTable(table: Record<string, unknown> | undefined): string | null {
  return getTableId(table);
}

async function fetchSubscriptionTiers(
  client: SuiClient,
  tableId: string
): Promise<TierPrice[]> {
  const { data } = await client.getDynamicFields({ parentId: tableId });
  const tiers: TierPrice[] = [];

  for (const df of data) {
    try {
      const nameObj = df.name as { type?: string; value?: number } | undefined;
      const tier = Number(nameObj?.value ?? 0);

      const fieldObj = await client.getDynamicFieldObject({
        parentId: tableId,
        name: df.name,
      });
      if (fieldObj.data?.content && "fields" in fieldObj.data.content) {
        const valueFields = fieldObj.data.content.fields as Record<string, unknown>;
        const value = valueFields?.value ?? valueFields;
        const priceMist = BigInt(String(value ?? 0));
        tiers.push({ tier, priceMist });
      }
    } catch {
      // Skip
    }
  }

  return tiers.sort((a, b) => a.tier - b.tier);
}

async function fetchPosts(client: SuiClient, tableId: string): Promise<PostInfo[]> {
  const { data } = await client.getDynamicFields({ parentId: tableId });
  const posts: PostInfo[] = [];

  for (const df of data) {
    try {
      const fieldObj = await client.getDynamicFieldObject({
        parentId: tableId,
        name: df.name,
      });

      if (!fieldObj.data?.content) continue;

      const content = fieldObj.data.content as Record<string, unknown>;
      const fields = content.fields as Record<string, unknown> | undefined;
      if (!fields) continue;

      const nameObj = df.name as { type?: string; value?: number } | undefined;
      const postId = Number(nameObj?.value ?? df.name ?? 0);
      const author = String(fields?.author ?? "");
      const contentType = Number(fields?.content_type ?? 0);
      const contentBytes = fields?.content;
      const contentStr = Array.isArray(contentBytes)
        ? new TextDecoder().decode(new Uint8Array(contentBytes))
        : String(contentBytes ?? "");
      const contentKeyBytes = fields?.content_key;
      const contentKey = Array.isArray(contentKeyBytes)
        ? new TextDecoder().decode(new Uint8Array(contentKeyBytes))
        : contentKeyBytes ? String(contentKeyBytes) : "";
      const timestampMs = Number(fields?.timestamp_ms ?? 0);
      const likedBy = (fields?.liked_by as unknown[]) ?? [];
      const likeCount = likedBy.length;

      posts.push({
        id: fieldObj.data.objectId,
        postId,
        author,
        contentType,
        content: contentStr,
        contentKey,
        timestampMs,
        likeCount,
      });
    } catch {
      // Skip unparseable posts
    }
  }

  return posts.sort((a, b) => b.postId - a.postId);
}
