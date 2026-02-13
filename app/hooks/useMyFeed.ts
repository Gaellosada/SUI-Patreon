"use client";

import { useQuery } from "@tanstack/react-query";
import { useSuiClient } from "@mysten/dapp-kit";
import type { SuiClient } from "@mysten/sui/client";
import { useNetworkVariable } from "@/networkConfig";

const PACKAGE_ID = process.env.NEXT_PUBLIC_ARTIST_PACKAGE_ID ?? "";

export type FeedComment = {
  author: string;
  content: string;
  timestampMs: number;
};

export type FeedPost = {
  communityId: string;
  communityName: string;
  communityCreator: string;
  postId: number;
  postObjectId: string;
  author: string;
  contentType: number;
  content: string;
  contentKey: string;
  timestampMs: number;
  likeCount: number;
  likedBy: string[];
  comments: FeedComment[];
};

export type FeedPoll = {
  communityId: string;
  communityName: string;
  communityCreator: string;
  pollId: number;
  question: string;
  options: string[];
  votes: number[];
  isClosed: boolean;
};

export type FeedItem =
  | { type: "post"; data: FeedPost }
  | { type: "poll"; data: FeedPoll };

function decodeBytes(value: unknown): string {
  if (!value) return "";
  if (typeof value === "string") return value;
  const arr = value as number[];
  if (Array.isArray(arr)) return new TextDecoder().decode(new Uint8Array(arr));
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

function extractObjectIdFromInput(inp: unknown): string | null {
  if (!inp || typeof inp !== "object") return null;
  const o = inp as Record<string, unknown>;
  // New format: { type: 'object', objectId: string, objectType: 'sharedObject'|'immOrOwnedObject' }
  if (typeof o.objectId === "string" && o.objectId.startsWith("0x")) return o.objectId;
  // Legacy format: { Object: { Shared: { objectId } } }
  const shared = o.Object as { Shared?: { objectId?: string } } | undefined;
  if (shared?.Shared?.objectId) return shared.Shared.objectId;
  return null;
}

function extractCommunityIdFromMoveCall(
  moveCall: { package: string; module: string; function: string; arguments?: unknown[] },
  inputs: unknown[],
  packageId: string
): string | null {
  const subscribeFunc = `${packageId}::community::subscribe`;
  const subscribeDurationFunc = `${packageId}::community::subscribe_for_duration`;
  const joinFunc = `${packageId}::community::join_community`;
  const fn = `${moveCall.package}::${moveCall.module}::${moveCall.function}`;
  const fnShort = `${moveCall.module}::${moveCall.function}`;

  if (
    fn !== subscribeFunc &&
    fn !== subscribeDurationFunc &&
    fn !== joinFunc &&
    fnShort !== "community::subscribe" &&
    fnShort !== "community::subscribe_for_duration" &&
    fnShort !== "community::join_community"
  ) {
    return null;
  }

  const args = moveCall.arguments ?? [];
  const firstArg = args[0];
  const inputIndex =
    typeof firstArg === "object" && firstArg && "Input" in firstArg
      ? (firstArg as { Input: number }).Input
      : typeof firstArg === "number"
        ? firstArg
        : -1;
  if (inputIndex >= 0 && inputs[inputIndex]) {
    return extractObjectIdFromInput(inputs[inputIndex]);
  }
  return null;
}

async function fetchFollowedCommunityIds(
  client: SuiClient,
  address: string,
  packageId: string
): Promise<string[]> {
  const communityIds = new Set<string>();
  let cursor: string | null = null;

  for (let page = 0; page < 5; page++) {
    const res = await client.queryTransactionBlocks({
      filter: { FromAddress: address },
      options: { showInput: true, showEffects: true },
      limit: 100,
      cursor: cursor ?? undefined,
    });

    const txs = res.data ?? [];
    if (!txs.length) break;

    for (const tx of txs) {
      const txBlockData =
        tx.transaction?.data ??
        (tx as { transaction?: unknown }).transaction ??
        tx;
      const sender =
        (txBlockData as { sender?: string })?.sender ?? (tx as { sender?: string }).sender;
      if (!txBlockData || sender !== address) continue;

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
        const objId = extractCommunityIdFromMoveCall(
          moveCall.MoveCall,
          inputs,
          packageId
        );
        if (objId) communityIds.add(objId);
      }
    }

    cursor = res.nextCursor ?? null;
    if (!cursor || !res.hasNextPage) break;
  }

  return [...communityIds];
}

async function fetchCommunityBasic(
  client: SuiClient,
  communityId: string
): Promise<{ name: string; creator: string } | null> {
  try {
    const obj = await client.getObject({
      id: communityId,
      options: { showContent: true, showType: true },
    });
    if (!obj.data?.content || !String(obj.data?.type ?? "").includes("Community"))
      return null;
    const fields = (obj.data.content as Record<string, unknown>).fields as Record<string, unknown>;
    return {
      name: decodeBytes(fields?.name),
      creator: String(fields?.creator ?? ""),
    };
  } catch {
    return null;
  }
}

async function fetchComments(
  client: SuiClient,
  commentsTableId: string
): Promise<FeedComment[]> {
  const { data } = await client.getDynamicFields({ parentId: commentsTableId });
  const comments: FeedComment[] = [];

  for (const df of data) {
    try {
      const fieldObj = await client.getDynamicFieldObject({
        parentId: commentsTableId,
        name: df.name,
      });
      if (!fieldObj.data?.content) continue;

      const content = fieldObj.data.content as Record<string, unknown>;
      const fields = content.fields as Record<string, unknown> | undefined;
      if (!fields) continue;

      const contentBytes = fields?.content;
      const contentStr = Array.isArray(contentBytes)
        ? new TextDecoder().decode(new Uint8Array(contentBytes))
        : String(contentBytes ?? "");
      const nameObj = df.name as { type?: string; value?: number } | undefined;
      const commentId = Number(nameObj?.value ?? 0);

      comments.push({
        author: String(fields?.author ?? ""),
        content: contentStr,
        timestampMs: Number(fields?.timestamp_ms ?? 0),
      });
    } catch {
      // skip
    }
  }

  return comments.sort((a, b) => a.timestampMs - b.timestampMs);
}

async function fetchPostsWithComments(
  client: SuiClient,
  communityId: string,
  communityName: string,
  communityCreator: string,
  postsTableId: string
): Promise<FeedPost[]> {
  const { data } = await client.getDynamicFields({ parentId: postsTableId });
  const posts: FeedPost[] = [];

  for (const df of data) {
    try {
      const fieldObj = await client.getDynamicFieldObject({
        parentId: postsTableId,
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
      const likedByRaw = (fields?.liked_by as unknown[]) ?? [];
      const likedBy = likedByRaw
        .map((a) => (typeof a === "string" ? a : (a as { id?: string })?.id ?? ""))
        .filter(Boolean);

      const commentsTable = fields?.comments as Record<string, unknown> | undefined;
      const commentsTableId = getTableId(commentsTable);
      const comments = commentsTableId
        ? await fetchComments(client, commentsTableId)
        : [];

      posts.push({
        communityId,
        communityName,
        communityCreator,
        postId,
        postObjectId: fieldObj.data.objectId,
        author,
        contentType,
        content: contentStr,
        contentKey,
        timestampMs,
        likeCount: likedBy.length,
        likedBy,
        comments,
      });
    } catch {
      // skip
    }
  }

  return posts.sort((a, b) => b.timestampMs - a.timestampMs);
}

async function fetchPolls(
  client: SuiClient,
  communityId: string,
  communityName: string,
  communityCreator: string,
  pollsTableId: string
): Promise<FeedPoll[]> {
  const { data } = await client.getDynamicFields({ parentId: pollsTableId });
  const polls: FeedPoll[] = [];

  for (const df of data) {
    try {
      const fieldObj = await client.getDynamicFieldObject({
        parentId: pollsTableId,
        name: df.name,
      });
      if (!fieldObj.data?.content) continue;

      const content = fieldObj.data.content as Record<string, unknown>;
      const fields = content.fields as Record<string, unknown> | undefined;
      if (!fields) continue;

      const nameObj = df.name as { type?: string; value?: number } | undefined;
      const pollId = Number(nameObj?.value ?? 0);

      const questionBytes = fields?.question;
      const questionStr = Array.isArray(questionBytes)
        ? new TextDecoder().decode(new Uint8Array(questionBytes))
        : String(questionBytes ?? "");

      const optionCount = Number(fields?.option_count ?? 0);
      const isClosed = Boolean(fields?.is_closed);

      const optionsTable = fields?.options as Record<string, unknown> | undefined;
      const optionsTableId = getTableId(optionsTable);
      const optionsList: string[] = [];
      if (optionsTableId) {
        const { data: optFields } = await client.getDynamicFields({ parentId: optionsTableId });
        const sortedOpts = optFields
          .map((f) => {
            const n = f.name as { value?: number } | undefined;
            return { idx: Number(n?.value ?? 0), name: f.name };
          })
          .sort((a, b) => a.idx - b.idx);
        for (const opt of sortedOpts) {
          try {
            const optObj = await client.getDynamicFieldObject({
              parentId: optionsTableId,
              name: opt.name,
            });
            if (optObj.data?.content && "fields" in optObj.data.content) {
              const f = optObj.data.content.fields as Record<string, unknown>;
              const v = f.value ?? f;
              const arr = Array.isArray(v) ? (v as number[]) : [];
              optionsList.push(arr.length ? new TextDecoder().decode(new Uint8Array(arr)) : "");
            }
          } catch {
            optionsList.push("");
          }
        }
      }

      const votesTable = fields?.votes as Record<string, unknown> | undefined;
      const votesTableId = getTableId(votesTable);
      const votesList: number[] = new Array(Math.max(optionCount, 1)).fill(0);
      if (votesTableId && optionCount > 0) {
        const { data: voteFields } = await client.getDynamicFields({ parentId: votesTableId });
        for (const vf of voteFields) {
          try {
            const vObj = await client.getDynamicFieldObject({
              parentId: votesTableId,
              name: vf.name,
            });
            const keyIdx = Number((vf.name as { value?: number })?.value ?? 0);
            if (vObj.data?.content && "fields" in vObj.data.content) {
              const flds = vObj.data.content.fields as Record<string, unknown>;
              const val = flds.value ?? flds;
              votesList[keyIdx] = Number(val ?? 0);
            }
          } catch {
            //
          }
        }
      }

      polls.push({
        communityId,
        communityName,
        communityCreator,
        pollId,
        question: questionStr,
        options: optionsList.length ? optionsList : Array.from({ length: optionCount }, (_, i) => `Option ${i + 1}`),
        votes: votesList,
        isClosed,
      });
    } catch {
      // skip
    }
  }

  return polls.sort((a, b) => b.pollId - a.pollId);
}

export function useMyFeed(address: string | undefined) {
  const suiClient = useSuiClient();
  const packageId = useNetworkVariable("artistPackageId") ?? PACKAGE_ID;

  return useQuery({
    queryKey: ["my-feed", address, packageId],
    queryFn: async (): Promise<FeedItem[]> => {
      if (!address || !packageId) return [];

      const communityIds = await fetchFollowedCommunityIds(
        suiClient,
        address,
        packageId
      );
      if (!communityIds.length) return [];

      const allItems: FeedItem[] = [];

      for (const communityId of communityIds) {
        const basic = await fetchCommunityBasic(suiClient, communityId);
        if (!basic) continue;

        const obj = await suiClient.getObject({
          id: communityId,
          options: { showContent: true },
        });
        if (!obj.data?.content) continue;

        const fields = (obj.data.content as Record<string, unknown>).fields as Record<string, unknown>;
        const postsTable = fields?.posts as Record<string, unknown> | undefined;
        const pollsTable = fields?.polls as Record<string, unknown> | undefined;
        const postsTableId = getTableId(postsTable);
        const pollsTableId = getTableId(pollsTable);

        if (postsTableId) {
          const posts = await fetchPostsWithComments(
            suiClient,
            communityId,
            basic.name,
            basic.creator,
            postsTableId
          );
          for (const p of posts) {
            allItems.push({ type: "post", data: p });
          }
        }

        if (pollsTableId) {
          const polls = await fetchPolls(
            suiClient,
            communityId,
            basic.name,
            basic.creator,
            pollsTableId
          );
          for (const p of polls) {
            allItems.push({ type: "poll", data: p });
          }
        }
      }

      return allItems.sort((a, b) => {
        const keyA = a.type === "post" ? a.data.timestampMs : 2e15 - a.data.pollId;
        const keyB = b.type === "post" ? b.data.timestampMs : 2e15 - b.data.pollId;
        return keyB - keyA;
      });
    },
    enabled: !!address && !!packageId,
  });
}
