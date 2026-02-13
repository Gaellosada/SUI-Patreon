"use client";

import { useEffect, useState, useRef } from "react";
import Link from "next/link";
import { Vote, Loader2, Plus, X, ChevronDown } from "lucide-react";
import { useCurrentAccount } from "@mysten/dapp-kit";
import {
  useSignAndExecuteTransaction,
  useSuiClient,
  useSuiClientQuery,
} from "@mysten/dapp-kit";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Transaction } from "@mysten/sui/transactions";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { ConnectButton } from "../components/ConnectButton";
import { BackButton } from "../components/BackButton";
import { useNetworkVariable } from "../networkConfig";
import { useCreatorCommunities } from "../hooks/useCreatorCommunities";

type PollInfo = {
  pollId: number;
  question: string;
  options: string[];
  votes: number[];
  isClosed: boolean;
};

function getTableId(table: Record<string, unknown> | undefined): string | null {
  if (!table) return null;
  const id = table.id;
  if (typeof id === "string") return id;
  const idObj = id as { id?: string } | undefined;
  return idObj?.id ?? null;
}

export default function PollPage() {
  const currentAccount = useCurrentAccount();
  const [zkAddress, setZkAddress] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [communityId, setCommunityId] = useState("");
  const [question, setQuestion] = useState("");
  const [options, setOptions] = useState(["", ""]);
  const [createSuccess, setCreateSuccess] = useState(false);
  const [voteSuccess, setVoteSuccess] = useState<number | null>(null);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const packageId = useNetworkVariable("artistPackageId");
  const ownerAddress = currentAccount?.address ?? zkAddress ?? "";
  const suiClient = useSuiClient();
  const queryClient = useQueryClient();

  const { data: communitiesData, isLoading: loadingCommunities } =
    useCreatorCommunities(ownerAddress || undefined);
  const ownedCommunities = communitiesData?.owned ?? [];
  const subscribedCommunities = communitiesData?.subscribed ?? [];
  const memberCommunities = [
    ...ownedCommunities,
    ...subscribedCommunities.filter((s) => !ownedCommunities.some((o) => o.id === s.id)),
  ];

  const { data: communityData } = useSuiClientQuery(
    "getObject",
    {
      id: communityId,
      options: { showContent: true, showOwner: true },
    },
    { enabled: !!communityId && communityId.length > 10 }
  );

  const communityContent =
    communityData?.data?.content?.dataType === "moveObject"
      ? (communityData.data.content as { fields?: Record<string, unknown> })
          ?.fields
      : null;
  const communityCreator = communityContent?.creator as string | undefined;
  const nameVal = communityContent?.name;
  const communityName = (communityContent?.name as number[] | undefined)
    ? new TextDecoder().decode(new Uint8Array(Array.isArray(communityContent?.name) ? communityContent.name : []))
    : "";
  const pollsTable = communityContent?.polls as Record<string, unknown> | undefined;
  const pollsTableId = getTableId(pollsTable);

  const { data: pollsList = [] } = useQuery({
    queryKey: ["community-polls", communityId, pollsTableId],
    queryFn: async (): Promise<PollInfo[]> => {
      if (!suiClient || !pollsTableId) return [];
      const { data } = await suiClient.getDynamicFields({ parentId: pollsTableId });
      const polls: PollInfo[] = [];

      for (const df of data) {
        try {
          const fieldObj = await suiClient.getDynamicFieldObject({
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
            const { data: optFields } = await suiClient.getDynamicFields({ parentId: optionsTableId });
            const sortedOpts = optFields
              .map((f) => {
                const n = f.name as { value?: number } | undefined;
                return { idx: Number(n?.value ?? 0), name: f.name };
              })
              .sort((a, b) => a.idx - b.idx);
            for (const opt of sortedOpts) {
              try {
                const optObj = await suiClient.getDynamicFieldObject({
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
            const { data: voteFields } = await suiClient.getDynamicFields({ parentId: votesTableId });
            for (const vf of voteFields) {
              try {
                const vObj = await suiClient.getDynamicFieldObject({
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
            pollId,
            question: questionStr,
            options: optionsList.length ? optionsList : Array.from({ length: optionCount }, (_, i) => `Option ${i + 1}`),
            votes: votesList,
            isClosed,
          });
        } catch {
          //
        }
      }
      return polls.sort((a, b) => a.pollId - b.pollId);
    },
    enabled: !!pollsTableId && !!communityId,
  });

  const isCreator =
    !!communityCreator &&
    !!ownerAddress &&
    communityCreator.toLowerCase() === ownerAddress.toLowerCase();

  const { mutate: signAndExecute, isPending } =
    useSignAndExecuteTransaction();

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
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setDropdownOpen(false);
      }
    };
    if (dropdownOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [dropdownOpen]);

  const isConnected = !!currentAccount || !!zkAddress;
  const hasPackageId = !!packageId?.trim();

  const addOption = () => setOptions([...options, ""]);
  const removeOption = (i: number) =>
    setOptions(options.filter((_, j) => j !== i));
  const updateOption = (i: number, v: string) => {
    const next = [...options];
    next[i] = v;
    setOptions(next);
  };

  const handleCreatePoll = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!hasPackageId || !communityId.trim()) {
      setError("Select a community and ensure package is configured.");
      return;
    }
    if (!isCreator) {
      setError("Only the community creator (artist) can create polls.");
      return;
    }
    const optStrings = options.filter((o) => o.trim());
    if (optStrings.length < 2) {
      setError("At least 2 options are required.");
      return;
    }
    if (!question.trim()) {
      setError("Question is required.");
      return;
    }

    // Use vector<u8> explicitly for Move. Strip null bytes and control chars
    // to avoid wallet "invalid JSON" errors when displaying transaction preview.
    const sanitize = (s: string) => s.replace(/[\x00-\x08\x0b\x0c\x0e-\x1f]/g, "");
    const questionBytes = Array.from(
      new TextEncoder().encode(sanitize(question.trim()))
    );
    const optBytes = optStrings.map((s) =>
      Array.from(new TextEncoder().encode(sanitize(s)))
    );
    const tx = new Transaction();
    tx.moveCall({
      target: `${packageId}::community::create_poll`,
      arguments: [
        tx.object(communityId.trim()),
        tx.pure.vector("u8", questionBytes),
        tx.pure.vector("vector<u8>", optBytes),
      ],
    });

    signAndExecute(
      { transaction: tx },
      {
        onSuccess: async ({ digest }) => {
          await suiClient.waitForTransaction({ digest });
          setCreateSuccess(true);
          setQuestion("");
          setOptions(["", ""]);
          void queryClient.invalidateQueries({ queryKey: ["community-polls", communityId] });
        },
        onError: (err) => {
          setError(err.message ?? "Transaction failed");
        },
      }
    );
  };

  const handleVote = (pollId: number, optionIndex: number) => {
    setError(null);
    if (!hasPackageId || !communityId.trim()) {
      setError("Select a community and ensure package is configured.");
      return;
    }
    // Must be a community member to vote - tx will fail with ENotMember (3) if not

    const tx = new Transaction();
    tx.moveCall({
      target: `${packageId}::community::vote_poll`,
      arguments: [
        tx.object(communityId.trim()),
        tx.pure.u64(pollId),
        tx.pure.u64(optionIndex),
      ],
    });

    signAndExecute(
      { transaction: tx },
      {
        onSuccess: async ({ digest }) => {
          await suiClient.waitForTransaction({ digest });
          setVoteSuccess(pollId);
          void queryClient.invalidateQueries({ queryKey: ["community-polls", communityId] });
        },
        onError: (err) => {
          setError(err.message ?? "Transaction failed");
        },
      }
    );
  };

  return (
    <main className="min-h-screen">
      <div className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <BackButton label="Back to feed" />

        <div className="glass-light rounded-2xl p-8 md:p-12 border border-white/15 animate-feed-in">
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center w-14 h-14 rounded-xl glass border border-white/15 mb-4">
              <Vote className="h-7 w-7 text-primary" />
            </div>
            <h1 className="text-2xl font-semibold text-foreground mb-2">
              Polls
            </h1>
            <p className="text-muted-foreground text-sm max-w-md mx-auto">
              Artists propose the next post; community members vote for their
              favorite option.
            </p>
          </div>

          <div className="space-y-6">
            <div>
              <label className="block text-sm font-medium text-foreground mb-2">
                Community
              </label>
              <div ref={dropdownRef} className="relative">
                <button
                  type="button"
                  onClick={() => setDropdownOpen(!dropdownOpen)}
                  className="w-full flex items-center justify-between gap-2 rounded-xl bg-background/60 border border-white/15 px-4 py-3 text-left text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 hover:border-white/25 transition-colors"
                >
                  <span className={communityId ? "" : "text-muted-foreground"}>
                    {communityId
                      ? (memberCommunities.find((c) => c.id === communityId)?.name || "Unnamed") +
                        " (" + communityId.slice(0, 8) + "...)"
                      : "Select a community..."}
                  </span>
                  <ChevronDown
                    className={`h-4 w-4 shrink-0 text-muted-foreground transition-transform ${
                      dropdownOpen ? "rotate-180" : ""
                    }`}
                  />
                </button>
                {dropdownOpen && (
                  <div className="absolute z-50 mt-1 w-full max-h-60 overflow-y-auto rounded-xl border border-white/15 shadow-xl py-1 bg-[hsl(var(--card))]">
                    <button
                      type="button"
                      onClick={() => {
                        setCommunityId("");
                        setDropdownOpen(false);
                      }}
                      className="w-full px-4 py-2.5 text-left text-sm text-muted-foreground hover:bg-white/10 hover:text-foreground transition-colors"
                    >
                      Select a community...
                    </button>
                    {loadingCommunities ? (
                      <div className="px-4 py-2.5 text-sm text-muted-foreground">
                        Loading...
                      </div>
                    ) : (
                      memberCommunities.map((c) => (
                        <button
                          key={c.id}
                          type="button"
                          onClick={() => {
                            setCommunityId(c.id);
                            setDropdownOpen(false);
                          }}
                          className={`w-full px-4 py-2.5 text-left text-sm transition-colors ${
                            communityId === c.id
                              ? "bg-primary/20 text-primary"
                              : "text-foreground hover:bg-white/10"
                          }`}
                        >
                          {c.name || "Unnamed"} ({c.id.slice(0, 8)}...)
                        </button>
                      ))
                    )}
                  </div>
                )}
              </div>
              {!loadingCommunities && memberCommunities.length === 0 && isConnected && (
                <p className="text-sm text-muted-foreground mt-2">
                  You&apos;re not a member of any community yet.{" "}
                  <Link
                    href="/create-community"
                    className="text-primary hover:underline"
                  >
                    Create one
                  </Link>{" "}
                  or join a community first.
                </p>
              )}
              {communityName && communityId && (
                <p className="text-xs text-muted-foreground mt-1">
                  {communityName}
                </p>
              )}
            </div>

            {!isConnected ? (
              <div className="rounded-xl glass-subtle border border-white/10 p-6 text-center">
                <p className="text-sm text-muted-foreground mb-4">
                  Connect your wallet to create or vote on polls
                </p>
                <ConnectButton />
              </div>
            ) : (
              <>
                {createSuccess && (
                  <div className="rounded-xl bg-green-500/15 border border-green-500/30 p-4">
                    <p className="text-sm text-green-400">Poll created!</p>
                  </div>
                )}

                {error && (
                  <div className="rounded-xl bg-destructive/15 border border-destructive/30 p-4">
                    <p className="text-sm text-destructive">{error}</p>
                  </div>
                )}

                {isCreator && communityId.trim() && (
                  <form
                    onSubmit={handleCreatePoll}
                    className="rounded-xl glass-subtle border border-white/10 p-6 space-y-4"
                  >
                    <h2 className="text-lg font-medium text-foreground">
                      Propose post options
                    </h2>
                    <p className="text-sm text-muted-foreground">
                      Ask your community what your next post should be about.
                    </p>
                    <Input
                      value={question}
                      onChange={(e) => setQuestion(e.target.value)}
                      placeholder="What should my next post be about?"
                    />
                    <div>
                      <label className="block text-sm font-medium text-foreground mb-2">
                        Post ideas
                      </label>
                      {options.map((opt, i) => (
                        <div key={i} className="flex gap-2 mb-2">
                          <Input
                            value={opt}
                            onChange={(e) => updateOption(i, e.target.value)}
                            placeholder={`Option ${i + 1}`}
                          />
                          {options.length > 2 && (
                            <button
                              type="button"
                              onClick={() => removeOption(i)}
                              className="p-2 text-muted-foreground hover:text-destructive"
                            >
                              <X className="h-4 w-4" />
                            </button>
                          )}
                        </div>
                      ))}
                      <button
                        type="button"
                        onClick={addOption}
                        className="text-sm text-primary hover:underline flex items-center gap-1"
                      >
                        <Plus className="h-4 w-4" />
                        Add option
                      </button>
                    </div>
                    <Button
                      type="submit"
                      variant="default"
                      size="lg"
                      className="w-full bg-blue-800 hover:bg-blue-700 text-white"
                      disabled={isPending || !hasPackageId}
                    >
                      {isPending ? (
                        <>
                          <Loader2 className="h-5 w-5 animate-spin" />
                          Creating...
                        </>
                      ) : (
                        "Create poll"
                      )}
                    </Button>
                  </form>
                )}

                {communityId.trim() && pollsList.length > 0 && (
                  <div className="rounded-xl glass-subtle border border-white/10 p-6 space-y-6">
                    <h2 className="text-lg font-medium text-foreground">
                      Polls ({pollsList.length})
                    </h2>
                    {pollsList.map((poll) => (
                      <div
                        key={poll.pollId}
                        className="rounded-lg border border-white/10 p-4 space-y-3"
                      >
                        <h3 className="font-medium text-foreground">
                          {poll.question}
                          {poll.isClosed && (
                            <span className="ml-2 text-xs text-muted-foreground">
                              (closed)
                            </span>
                          )}
                        </h3>
                        <div className="space-y-2">
                          {poll.options.map((opt, optIdx) => (
                            <div
                              key={optIdx}
                              className="flex items-center gap-2"
                            >
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                className="flex-1 min-w-0 justify-start text-left h-auto py-2"
                                disabled={poll.isClosed || isPending}
                                onClick={() => handleVote(poll.pollId, optIdx)}
                              >
                                <span className="truncate">{opt}</span>
                                {poll.votes[optIdx] !== undefined && (
                                  <span className="ml-auto text-muted-foreground text-xs shrink-0">
                                    {poll.votes[optIdx]} votes
                                  </span>
                                )}
                              </Button>
                            </div>
                          ))}
                          {voteSuccess === poll.pollId && (
                            <p className="text-xs text-green-500">Voted!</p>
                          )}
                        </div>
                        {poll.isClosed && (
                          <p className="text-xs text-muted-foreground">
                            Artist will post based on the winning option.
                          </p>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </>
            )}
          </div>

          <p className="text-xs text-muted-foreground text-center mt-6">
            Select a community you&apos;re a member of. Artists propose post ideas
            as poll options; members vote for their favorite.
          </p>
        </div>
      </div>
    </main>
  );
}
