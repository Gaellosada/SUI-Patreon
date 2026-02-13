"use client";

import { useQuery } from "@tanstack/react-query";
import { useSuiClient } from "@mysten/dapp-kit";
import type { SuiClient } from "@mysten/sui/client";
import { useNetworkVariable } from "@/networkConfig";

const PACKAGE_ID = process.env.NEXT_PUBLIC_ARTIST_PACKAGE_ID ?? "";

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
        fetchOwnedCommunities(suiClient, address, artistCommunitiesType, communityType),
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
  artistCommunitiesType: string,
  communityType: string
): Promise<CommunityInfo[]> {
  try {
    const { data: owned } = await client.getOwnedObjects({
      owner: address,
      filter: { StructType: artistCommunitiesType },
      options: { showContent: true },
    });

    if (!owned?.length) return [];

    const communityIds: string[] = [];
    for (const obj of owned) {
      if (obj.data?.content && "fields" in obj.data.content) {
        const fields = obj.data.content.fields as Record<string, unknown>;
        const communityIdsField = fields.community_ids as Record<string, unknown> | undefined;
        const tableId = communityIdsField && typeof communityIdsField === "object"
          ? (communityIdsField.id as Record<string, string> | undefined)?.id ?? (communityIdsField as { id?: string }).id
          : undefined;
        if (tableId && typeof tableId === "string") {
          const dynamicFields = await client.getDynamicFields({ parentId: tableId });
          for (const df of dynamicFields.data) {
            try {
              const fieldObj = await client.getDynamicFieldObject({
                parentId: tableId,
                name: df.name,
              });
              if (fieldObj.data?.content && "fields" in fieldObj.data.content) {
                const valueFields = fieldObj.data.content.fields as Record<string, string>;
                const value = valueFields?.value ?? valueFields?.id;
                if (value) communityIds.push(value);
              } else if (fieldObj.data?.content && "type" in fieldObj.data.content) {
                const content = fieldObj.data.content as Record<string, unknown>;
                const value = content.value ?? content.id;
                if (typeof value === "string") communityIds.push(value);
              }
            } catch {
              // Skip fields we can't parse
            }
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
        if (fn !== subscribeFunc && fn !== subscribeDurationFunc) continue;

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
    .filter((o) => o.data?.content && o.data?.type === communityType)
    .map((o) => {
      const fields = (o.data!.content as Record<string, unknown>).fields as Record<string, unknown>;
      const name = (fields?.name as number[]) ?? [];
      const description = (fields?.description as number[]) ?? [];
      return {
        id: o.data!.objectId,
        name: new TextDecoder().decode(new Uint8Array(name)),
        description: new TextDecoder().decode(new Uint8Array(description)),
        creator: String(fields?.creator ?? ""),
      };
    });
}
