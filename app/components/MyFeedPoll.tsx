"use client";

import { useState } from "react";
import Link from "next/link";
import { Vote, Loader2 } from "lucide-react";
import { useSignAndExecuteTransaction } from "@mysten/dapp-kit";
import { Transaction } from "@mysten/sui/transactions";
import { Button } from "./ui/button";
import { ConnectButton } from "./ConnectButton";
import { ConnectWalletToInteract } from "./ConnectWalletToInteract";
import { useNetworkVariable } from "@/networkConfig";
import { useQueryClient } from "@tanstack/react-query";
import type { FeedPoll } from "@/hooks/useMyFeed";
import { cn } from "@/lib/utils";

export function MyFeedPoll({
  poll,
  viewerAddress,
  canSign,
  index = 0,
}: {
  poll: FeedPoll;
  viewerAddress: string | undefined;
  canSign: boolean;
  index?: number;
}) {
  const packageId = useNetworkVariable("artistPackageId");
  const queryClient = useQueryClient();
  const { mutate: signAndExecute, isPending } = useSignAndExecuteTransaction();
  const [voteSuccess, setVoteSuccess] = useState(false);
  const [showConnectOverlay, setShowConnectOverlay] = useState(false);
  const [voteError, setVoteError] = useState<string | null>(null);
  const [needsJoin, setNeedsJoin] = useState(false);

  const refreshFeed = () => {
    queryClient.invalidateQueries({ queryKey: ["my-feed"] });
  };

  const handleJoinCommunity = () => {
    if (!canSign || !packageId) return;
    setVoteError(null);
    setNeedsJoin(false);

    const tx = new Transaction();
    tx.moveCall({
      target: `${packageId}::community::join_community`,
      arguments: [tx.object(poll.communityId)],
    });

    signAndExecute(
      { transaction: tx },
      {
        onSuccess: () => {
          refreshFeed();
        },
        onError: (err) => {
          const msg = err.message ?? "";
          if (msg.includes(", 0)") || msg.includes("EAlreadyMember")) {
            setVoteError("Already a member — try voting again.");
          } else {
            setVoteError(err.message ?? "Join failed");
          }
        },
      }
    );
  };

  const handleVote = (optionIndex: number) => {
    if (!canSign || !packageId || poll.isClosed) return;
    setVoteError(null);

    const tx = new Transaction();
    tx.moveCall({
      target: `${packageId}::community::vote_poll`,
      arguments: [
        tx.object(poll.communityId),
        tx.pure.u64(poll.pollId),
        tx.pure.u64(optionIndex),
      ],
    });

    signAndExecute(
      { transaction: tx },
      {
        onSuccess: () => {
          setVoteSuccess(true);
          setNeedsJoin(false);
          refreshFeed();
        },
        onError: (err) => {
          const msg = err.message ?? "";
          if (msg.includes(", 3)") || msg.includes("ENotMember")) {
            setNeedsJoin(true);
            setVoteError("Join the community first to vote.");
          } else {
            setVoteError(err.message ?? "Vote failed");
          }
        },
      }
    );
  };

  const handlePollInteraction = () => {
    if (!canSign) setShowConnectOverlay(true);
  };

  const totalVotes = poll.votes.reduce((a, b) => a + b, 0);

  return (
    <div
      className="animate-feed-in overflow-visible"
      style={{ animationDelay: `${index * 80}ms` }}
    >
      <article
        className={cn(
          "glass-light rounded-2xl border border-white/15 relative overflow-hidden",
          !canSign && "cursor-pointer"
        )}
        onClick={!canSign ? handlePollInteraction : undefined}
        onMouseEnter={!canSign ? () => setShowConnectOverlay(true) : undefined}
        onMouseLeave={!canSign ? () => setShowConnectOverlay(false) : undefined}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-full bg-gradient-to-br from-amber-500/40 to-amber-600 flex items-center justify-center shrink-0 ring-2 ring-white/20">
              <Vote className="h-5 w-5 text-amber-200" />
            </div>
            <div>
              <span className="font-semibold text-foreground">Poll</span>
              <Link
                href={`/community/${poll.communityId}`}
                className="block text-sm text-muted-foreground hover:text-primary"
              >
                in {poll.communityName || "Community"}
              </Link>
            </div>
          </div>
          {poll.isClosed && (
            <span className="text-xs text-muted-foreground bg-white/10 px-2 py-1 rounded-lg">
              Closed
            </span>
          )}
        </div>

        {/* Question */}
        <div className="px-4 pb-2">
          <h3 className="font-medium text-foreground">{poll.question}</h3>
        </div>

        {/* Options */}
        <div className="px-4 pb-4 space-y-2">
          {poll.options.map((opt, optIdx) => {
            const voteCount = poll.votes[optIdx] ?? 0;
            const pct = totalVotes > 0 ? (voteCount / totalVotes) * 100 : 0;
            return (
              <div key={optIdx} className="flex items-center gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className={cn(
                    "flex-1 min-w-0 justify-start text-left h-auto py-2.5 relative overflow-hidden",
                    poll.isClosed && "cursor-default"
                  )}
                  disabled={poll.isClosed || isPending}
                  onClick={() => handleVote(optIdx)}
                >
                  <span className="relative z-10 truncate">{opt}</span>
                  {totalVotes > 0 && (
                    <span
                      className="absolute inset-y-0 left-0 bg-primary/20 -z-0 transition-all"
                      style={{ width: `${pct}%` }}
                    />
                  )}
                  <span className="ml-auto text-muted-foreground text-xs shrink-0 relative z-10">
                    {voteCount} vote{voteCount !== 1 ? "s" : ""}
                  </span>
                </Button>
              </div>
            );
          })}
          {voteSuccess && (
            <p className="text-xs text-green-500 mt-2">Voted!</p>
          )}
          {voteError && (
            <p className="text-xs text-destructive mt-2">{voteError}</p>
          )}
          {needsJoin && (
            <Button
              variant="outline"
              size="sm"
              className="mt-2 w-full"
              onClick={handleJoinCommunity}
              disabled={isPending}
            >
              {isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                "Join community to vote"
              )}
            </Button>
          )}
        </div>

        {/* Connect overlay */}
        {!canSign && showConnectOverlay && (
          <div
            className="absolute inset-0 z-20 flex flex-col items-center justify-center gap-3 bg-black/60 backdrop-blur-sm animate-feed-slide rounded-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <Vote className="h-7 w-7 text-white/90" />
            {viewerAddress ? (
              <ConnectWalletToInteract action="vote on polls" />
            ) : (
              <ConnectButton variant="dark" />
            )}
          </div>
        )}
      </article>
    </div>
  );
}
