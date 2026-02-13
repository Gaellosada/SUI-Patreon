"use client";

import { useQuery } from "@tanstack/react-query";
import { useSuiClient } from "@mysten/dapp-kit";
import type { SuiClient } from "@mysten/sui/client";
import { useNetworkVariable } from "@/networkConfig";

const PACKAGE_ID = process.env.NEXT_PUBLIC_ARTIST_PACKAGE_ID ?? "";

function extractTableId(table: Record<string, unknown> | undefined): string | null {
  if (!table || typeof table !== "object") return null;
  const idField = table.id ?? (table.fields as Record<string, unknown>)?.id;
  if (typeof idField === "string") return idField;
  const idObj = idField as { id?: string } | undefined;
  return idObj?.id ?? null;
}

function extractFieldValue(content: unknown): string | null {
  if (!content || typeof content !== "object") return null;
  const c = content as Record<string, unknown>;
  const fields = c.fields as Record<string, unknown> | undefined;
  const value = fields?.value ?? c.value ?? fields?.id ?? c.id;
  return typeof value === "string" ? value : null;
}

function decodeBytes(value: unknown): string {
  if (!value) return "";
  if (typeof value === "string") return value;
  const arr = value as number[] | Uint8Array;
  if (Array.isArray(arr)) return new TextDecoder().decode(new Uint8Array(arr));
  if (arr instanceof Uint8Array) return new TextDecoder().decode(arr);
  return "";
}

export type CommunityInfo = {
  id: string;
  name: string;
  description: string;
  creator: string;
};

export function useCreatorCommunities(address: string | undefined) {
  const suiClient = useSuiClient();
  const packageId = useNetworkVariable("artistPackageId") ?? PACKAGE_ID;

  const communityType = packageId ? `${packageId}::community::Community` : "";
  const artistCommunitiesType = packageId ? `${packageId}::artist::ArtistCommunities` : "";
  const tierMembershipType = packageId ? `${packageId}::tier_seal::TierMembership` : "";

  return useQuery({
    queryKey: ["creator-communities", address, packageId],
    queryFn: async (): Promise<{
      owned: CommunityInfo[];
      subscribed: CommunityInfo[];
      tierMemberships: { id: string; tier: number }[];
    }> => {
      if (!address || !packageId) {
        return { owned: [], subscribed: [], tierMemberships: [] };
      }

      const [owned, subscribed, tierMemberships] = await Promise.all([
        fetchOwnedCommunities(suiClient, address, packageId, artistCommunitiesType, communityType),
        fetchSubscribedCommunities(suiClient, address, packageId, communityType),
        fetchTierMemberships(suiClient, address, tierMembershipType),
      ]);

      return { owned, subscribed, tierMemberships };
    },
    enabled: !!address && !!packageId,
  });
}

async function fetchOwnedCommunities(
  client: SuiClient,
  address: string,
  packageId: string,
  artistCommunitiesType: string,
  communityType: string
): Promise<CommunityInfo[]> {
  try {
    let owned = (
      await client.getOwnedObjects({
        owner: address,
        filter: { StructType: artistCommunitiesType },
        options: { showContent: true, showType: true },
      })
    ).data;

    // Fallback: try Package filter or fetch all and filter by type
    if (!owned?.length && packageId) {
      const pkg = await client.getOwnedObjects({
        owner: address,
        filter: { Package: packageId },
        options: { showContent: true, showType: true },
        limit: 50,
      });
      owned = (pkg.data ?? []).filter(
        (o) => o.data?.type?.includes("ArtistCommunities") ?? false
      );
    }
    if (!owned?.length) {
      const unfiltered = await client.getOwnedObjects({
        owner: address,
        options: { showContent: true, showType: true },
        limit: 50,
      });
      owned = (unfiltered.data ?? []).filter(
        (o) => o.data?.type?.includes("ArtistCommunities") ?? false
      );
    }

    if (!owned?.length) return [];

    const communityIds: string[] = [];
    for (const obj of owned) {
      const content = obj.data?.content;
      if (!content || typeof content !== "object") continue;

      const fields = (content as Record<string, unknown>).fields as Record<string, unknown> | undefined;
      const communityIdsField = fields?.community_ids as Record<string, unknown> | undefined;
      const tableId = extractTableId(communityIdsField);

      if (tableId) {
          const dynamicFields = await client.getDynamicFields({ parentId: tableId });
          for (const df of dynamicFields.data) {
            try {
              const fieldObj = await client.getDynamicFieldObject({
                parentId: tableId,
                name: df.name,
              });
              const value = extractFieldValue(fieldObj.data?.content);
              if (typeof value === "string" && value.startsWith("0x")) {
                communityIds.push(value);
              }
            } catch {
              // Skip fields we can't parse
            }
          }
        }
    }

    return fetchCommunityDetails(client, communityIds, communityType);
  } catch {
    return [];
  }
}

async function fetchSubscribedCommunities(
  client: SuiClient,
  address: string,
  packageId: string,
  communityType: string
): Promise<CommunityInfo[]> {
  try {
    const subscribeFunc = `${packageId}::community::subscribe`;
    const subscribeDurationFunc = `${packageId}::community::subscribe_for_duration`;
    const joinFunc = `${packageId}::community::join_community`;

    const res = await client.queryTransactionBlocks({
      filter: { FromAddress: address },
      options: { showInput: true, showEffects: true },
      limit: 100,
    });

    const communityIds = new Set<string>();
    for (const tx of res.data ?? []) {
      const txBlockData = tx.transaction?.data;
      const sender = (txBlockData as { sender?: string })?.sender ?? (tx as { sender?: string }).sender;
      if (!txBlockData || sender !== address) continue;

      const progTx = (txBlockData as { transaction?: { kind?: string; inputs?: unknown[]; transactions?: unknown[] } })
        .transaction;
      if (progTx?.kind !== "ProgrammableTransaction") continue;

      const inputs = progTx.inputs ?? [];
      const transactions = progTx.transactions ?? [];

      for (const cmd of transactions) {
        const moveCall = cmd as { MoveCall?: { package: string; module: string; function: string; arguments?: unknown[] } };
        if (!moveCall?.MoveCall) continue;
        const fn = `${moveCall.MoveCall.package}::${moveCall.MoveCall.module}::${moveCall.MoveCall.function}`;
        const isSubscribed =
          fn === subscribeFunc || fn === subscribeDurationFunc || fn === joinFunc;
        if (!isSubscribed) continue;

        const args = moveCall.MoveCall.arguments ?? [];
        const firstArg = args[0];
        const inputIndex = typeof firstArg === "object" && firstArg && "Input" in firstArg
          ? (firstArg as { Input: number }).Input
          : typeof firstArg === "number"
            ? firstArg
            : -1;
        if (inputIndex >= 0 && inputs[inputIndex]) {
          const inp = inputs[inputIndex] as Record<string, unknown>;
          const objId = typeof inp?.objectId === "string" && inp.objectId.startsWith("0x")
            ? inp.objectId
            : (inp?.Object as { Shared?: { objectId?: string } })?.Shared?.objectId;
          if (objId) communityIds.add(objId);
        }
      }
    }

    return fetchCommunityDetails(client, [...communityIds], communityType);
  } catch {
    return [];
  }
}

async function fetchTierMemberships(
  client: SuiClient,
  address: string,
  tierMembershipType: string
): Promise<{ id: string; tier: number }[]> {
  try {
    const { data } = await client.getOwnedObjects({
      owner: address,
      filter: { StructType: tierMembershipType },
      options: { showContent: true },
    });

    if (!data?.length) return [];

    return data
      .filter((o) => !!o.data?.content)
      .map((o) => {
        const d = o.data!;
        const fields = (d.content as Record<string, unknown>).fields as Record<string, unknown> | undefined;
        const tier = Number(fields?.tier ?? 0);
        return { id: d.objectId, tier };
      });
  } catch {
    return [];
  }
}

async function fetchCommunityDetails(
  client: SuiClient,
  ids: string[],
  communityType: string
): Promise<CommunityInfo[]> {
  if (!ids.length) return [];

  const unique = [...new Set(ids)];
  const objects = await client.multiGetObjects({
    ids: unique,
    options: { showContent: true, showType: true },
  });

  return objects
    .filter(
      (o) =>
        o.data?.content &&
        (o.data?.type === communityType || String(o.data?.type ?? "").includes("Community"))
    )
    .map((o) => {
      const fields = (o.data!.content as Record<string, unknown>).fields as Record<string, unknown>;
      return {
        id: o.data!.objectId,
        name: decodeBytes(fields?.name),
        description: decodeBytes(fields?.description),
        creator: String(fields?.creator ?? ""),
      };
    });
}
