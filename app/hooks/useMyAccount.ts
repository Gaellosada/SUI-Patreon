"use client";

import { useQuery } from "@tanstack/react-query";
import { useSuiClient } from "@mysten/dapp-kit";
import type { SuiClient } from "@mysten/sui/client";
import { useNetworkVariable } from "@/networkConfig";
import type { CommunityInfo } from "./useCreatorCommunities";

const PACKAGE_ID = process.env.NEXT_PUBLIC_ARTIST_PACKAGE_ID ?? "";

function getTableId(table: Record<string, unknown> | undefined): string | null {
  if (!table) return null;
  const id = table.id ?? (table.fields as Record<string, unknown>)?.id;
  if (typeof id === "string" && id.startsWith("0x")) return id;
  const idObj = id as { id?: string } | undefined;
  return idObj?.id ?? null;
}

function extractAddressFromFieldName(name: unknown): string | null {
  if (typeof name === "string" && name.startsWith("0x")) return name;
  const obj = name as { value?: string | { id?: string }; type?: string } | undefined;
  const val = obj?.value;
  if (typeof val === "string" && val.startsWith("0x")) return val;
  if (val && typeof val === "object" && typeof (val as { id?: string }).id === "string") {
    const id = (val as { id: string }).id;
    if (id.startsWith("0x")) return id;
  }
  return null;
}

async function fetchMemberAddresses(
  client: SuiClient,
  membersTableId: string
): Promise<string[]> {
  const { data } = await client.getDynamicFields({ parentId: membersTableId });
  const addresses: string[] = [];
  for (const df of data) {
    const addr = extractAddressFromFieldName(df.name);
    if (addr) addresses.push(addr);
  }
  return addresses;
}

async function fetchFollowers(
  client: SuiClient,
  address: string,
  packageId: string
): Promise<string[]> {
  const artistCommunitiesType = `${packageId}::artist::ArtistCommunities`;
  const communityType = `${packageId}::community::Community`;

  const owned = (
    await client.getOwnedObjects({
      owner: address,
      filter: { StructType: artistCommunitiesType },
      options: { showContent: true, showType: true },
    })
  ).data;

  if (!owned?.length) return [];

  const allFollowers = new Set<string>();
  const communityIds: string[] = [];

  for (const obj of owned) {
    const content = obj.data?.content;
    if (!content || typeof content !== "object") continue;
    const fields = (content as Record<string, unknown>).fields as Record<string, unknown> | undefined;
    const communityIdsField = fields?.community_ids as Record<string, unknown> | undefined;
    const tableId = getTableId(communityIdsField);
    if (!tableId) continue;

    const dynamicFields = await client.getDynamicFields({ parentId: tableId });
    for (const df of dynamicFields.data) {
      try {
        const fieldObj = await client.getDynamicFieldObject({
          parentId: tableId,
          name: df.name,
        });
        const c = fieldObj.data?.content as Record<string, unknown> | undefined;
        const fields = c?.fields as Record<string, unknown> | undefined;
        const val = fields?.value ?? c?.value ?? c?.id ?? (c as { id?: string })?.id;
        const communityId = typeof val === "string" && val.startsWith("0x") ? val : null;
        if (communityId) communityIds.push(communityId);
      } catch {
        // skip
      }
    }
  }

  for (const communityId of communityIds) {
    try {
      const obj = await client.getObject({
        id: communityId,
        options: { showContent: true },
      });
      if (!obj.data?.content) continue;
      const fields = (obj.data.content as Record<string, unknown>).fields as Record<string, unknown>;
      const membersTable = fields?.members as Record<string, unknown> | undefined;
      const membersTableId = getTableId(membersTable);
      if (!membersTableId) continue;

      const members = await fetchMemberAddresses(client, membersTableId);
      members.forEach((a) => allFollowers.add(a));
    } catch {
      // skip
    }
  }

  return [...allFollowers];
}

async function fetchFollowing(
  client: SuiClient,
  address: string,
  packageId: string
): Promise<CommunityInfo[]> {
  const communityIds = new Set<string>();
  const subscribeFunc = `${packageId}::community::subscribe`;
  const subscribeDurationFunc = `${packageId}::community::subscribe_for_duration`;
  const joinFunc = `${packageId}::community::join_community`;

  const res = await client.queryTransactionBlocks({
    filter: { FromAddress: address },
    options: { showInput: true, showEffects: true },
    limit: 200,
  });

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
      const moveCall = cmd as {
        MoveCall?: { package: string; module: string; function: string; arguments?: unknown[] };
      };
      if (!moveCall?.MoveCall) continue;
      const fn = `${moveCall.MoveCall.package}::${moveCall.MoveCall.module}::${moveCall.MoveCall.function}`;

      if (fn === subscribeFunc || fn === subscribeDurationFunc || fn === joinFunc) {
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
  }

  if (!communityIds.size) return [];

  const communityType = `${packageId}::community::Community`;
  const objects = await client.multiGetObjects({
    ids: [...communityIds],
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
      const decode = (v: unknown) => {
        if (!v) return "";
        if (typeof v === "string") return v;
        const arr = v as number[];
        return Array.isArray(arr) ? new TextDecoder().decode(new Uint8Array(arr)) : "";
      };
      return {
        id: o.data!.objectId,
        name: decode(fields?.name),
        description: decode(fields?.description),
        creator: String(fields?.creator ?? ""),
      };
    });
}

export type MyAccountData = {
  isArtist: boolean;
  followers: string[];
  following: CommunityInfo[];
};

export function useMyAccount(address: string | undefined) {
  const suiClient = useSuiClient();
  const packageId = useNetworkVariable("artistPackageId") ?? PACKAGE_ID;

  return useQuery({
    queryKey: ["my-account", address, packageId],
    queryFn: async (): Promise<MyAccountData> => {
      if (!address || !packageId) {
        return { isArtist: false, followers: [], following: [] };
      }

      const artistCommunitiesType = `${packageId}::artist::ArtistCap`;
      const artistCheck = (
        await suiClient.getOwnedObjects({
          owner: address,
          filter: { StructType: artistCommunitiesType },
          options: { showType: true },
          limit: 1,
        })
      ).data?.length;

      const isArtist = !!artistCheck;

      const [followers, following] = await Promise.all([
        isArtist ? fetchFollowers(suiClient, address, packageId) : Promise.resolve([]),
        fetchFollowing(suiClient, address, packageId),
      ]);

      return { isArtist, followers, following };
    },
    enabled: !!address && !!packageId,
  });
}
