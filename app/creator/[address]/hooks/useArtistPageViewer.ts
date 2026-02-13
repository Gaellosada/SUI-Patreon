"use client";

import { useQuery } from "@tanstack/react-query";
import { useSuiClient } from "@mysten/dapp-kit";
import type { SuiClient } from "@mysten/sui/client";
import { useNetworkVariable } from "@/networkConfig";
import type { CommunityInfo } from "@/hooks/useCreatorCommunities";

const PACKAGE_ID = process.env.NEXT_PUBLIC_ARTIST_PACKAGE_ID ?? "";

function getTableId(table: Record<string, unknown> | undefined): string | null {
  if (!table) return null;
  const nested = (table.fields as Record<string, unknown>) ?? table;
  const id = table.id ?? nested.id;
  if (typeof id === "string" && id.startsWith("0x")) return id;
  const idObj = id as { id?: string } | undefined;
  return idObj?.id ?? null;
}

async function checkViewerIsMember(
  client: SuiClient,
  communityId: string,
  viewerAddress: string
): Promise<boolean> {
  try {
    const obj = await client.getObject({
      id: communityId,
      options: { showContent: true },
    });
    if (!obj.data?.content) return false;
    const fields = (obj.data.content as Record<string, unknown>).fields as Record<string, unknown>;
    const membersTable = fields?.members as Record<string, unknown> | undefined;
    const membersTableId = getTableId(membersTable);
    if (!membersTableId) return false;
    const { data } = await client.getDynamicFields({ parentId: membersTableId });
    const creator = String(fields?.creator ?? "");
    if (creator.toLowerCase() === viewerAddress.toLowerCase()) return true;
    return data.some((df) => {
      const name = df.name as { type?: string; value?: string } | undefined;
      const val = name?.value ?? (typeof df.name === "string" ? df.name : null);
      return val?.toLowerCase() === viewerAddress.toLowerCase();
    });
  } catch {
    return false;
  }
}

export type ArtistCommunityWithStatus = CommunityInfo & {
  viewerIsMember: boolean;
};

export function useArtistPageViewer(
  viewerAddress: string | undefined,
  artistAddress: string | undefined,
  artistCommunities: CommunityInfo[]
) {
  const suiClient = useSuiClient();
  const packageId = useNetworkVariable("artistPackageId") ?? PACKAGE_ID;

  return useQuery({
    queryKey: [
      "artist-page-viewer",
      viewerAddress,
      artistAddress,
      artistCommunities.map((c) => c.id).join(","),
    ],
    queryFn: async (): Promise<{
      artistCommunitiesWeFollow: ArtistCommunityWithStatus[];
      isFollowing: boolean;
    }> => {
      if (!viewerAddress || !artistAddress || !packageId) {
        return { artistCommunitiesWeFollow: [], isFollowing: false };
      }

      const res = await suiClient.queryTransactionBlocks({
        filter: { FromAddress: viewerAddress },
        options: { showInput: true, showEffects: true },
        limit: 200,
      });

      const communityIds = new Set<string>();
      const subscribeFunc = `${packageId}::community::subscribe`;
      const subscribeDurationFunc = `${packageId}::community::subscribe_for_duration`;
      const joinFunc = `${packageId}::community::join_community`;

      for (const tx of res.data ?? []) {
        const txBlockData = tx.transaction?.data ?? (tx as { transaction?: unknown }).transaction;
        const sender =
          (txBlockData as { sender?: string })?.sender ?? (tx as { sender?: string }).sender;
        if (!txBlockData || sender !== viewerAddress) continue;

        const innerTx = (txBlockData as { transaction?: unknown }).transaction ?? txBlockData;
        const progTx = innerTx as {
          kind?: string;
          inputs?: unknown[];
          transactions?: unknown[];
          commands?: unknown[];
        };
        if (progTx.kind !== "ProgrammableTransaction") continue;

        const inputs = progTx.inputs ?? [];
        const commands = progTx.transactions ?? progTx.commands ?? [];

        for (const cmd of commands) {
          const moveCall = cmd as {
            MoveCall?: {
              package: string;
              module: string;
              function: string;
              arguments?: unknown[];
            };
          };
          if (!moveCall?.MoveCall) continue;
          const fn = `${moveCall.MoveCall.package}::${moveCall.MoveCall.module}::${moveCall.MoveCall.function}`;
          if (
            fn !== subscribeFunc &&
            fn !== subscribeDurationFunc &&
            fn !== joinFunc
          )
            continue;

          const args = moveCall.MoveCall.arguments ?? [];
          const firstArg = args[0];
          const inputIndex =
            typeof firstArg === "object" && firstArg && "Input" in firstArg
              ? (firstArg as { Input: number }).Input
              : typeof firstArg === "number"
                ? firstArg
                : -1;
          if (inputIndex >= 0 && inputs[inputIndex]) {
            const inp = inputs[inputIndex] as Record<string, unknown>;
            const objId =
              typeof inp?.objectId === "string" && inp.objectId.startsWith("0x")
                ? inp.objectId
                : (inp?.Object as { Shared?: { objectId?: string } })?.Shared?.objectId;
            if (objId) communityIds.add(objId);
          }
        }
      }

      const artistAddrLower = artistAddress.toLowerCase();
      const communitiesWeFollow = artistCommunities.filter(
        (c) =>
          c.creator.toLowerCase() === artistAddrLower && communityIds.has(c.id)
      );

      const withStatus: ArtistCommunityWithStatus[] = await Promise.all(
        communitiesWeFollow.map(async (c) => ({
          ...c,
          viewerIsMember: await checkViewerIsMember(
            suiClient,
            c.id,
            viewerAddress
          ),
        }))
      );

      return {
        artistCommunitiesWeFollow: withStatus,
        isFollowing: withStatus.length > 0,
      };
    },
    enabled:
      !!viewerAddress &&
      !!artistAddress &&
      !!packageId &&
      artistCommunities.length > 0,
  });
}
