"use client";

import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useSignAndExecuteTransaction, useSuiClient } from "@mysten/dapp-kit";
import { Transaction } from "@mysten/sui/transactions";
import { useNetworkVariable } from "@/networkConfig";
import type { ArtistCommunityWithStatus } from "./useArtistPageViewer";

export function useArtistUnfollow() {
  const [error, setError] = useState<string | null>(null);
  const [isUnfollowing, setIsUnfollowing] = useState(false);
  const queryClient = useQueryClient();
  const suiClient = useSuiClient();
  const { mutate: signAndExecute, isPending } = useSignAndExecuteTransaction();
  const packageId = useNetworkVariable("artistPackageId");

  const unfollow = (communitiesToLeave: ArtistCommunityWithStatus[]) => {
    setError(null);
    const toLeave = communitiesToLeave.filter((c) => c.viewerIsMember);
    if (!packageId) {
      setError("Package not configured.");
      return;
    }
    if (toLeave.length === 0) {
      setError(
        "You're not a member of any communities. Visit each community page to cancel your membership."
      );
      return;
    }

    setIsUnfollowing(true);
    const tx = new Transaction();
    for (const c of toLeave) {
      tx.moveCall({
        target: `${packageId}::community::leave_community`,
        arguments: [tx.object(c.id)],
      });
    }

    signAndExecute(
      { transaction: tx },
      {
        onSuccess: async ({ digest }) => {
          await suiClient.waitForTransaction({ digest });
          setError(null);
          void queryClient.invalidateQueries({ queryKey: ["artist-page-viewer"] });
          void queryClient.invalidateQueries({ queryKey: ["creator-communities"] });
          void queryClient.invalidateQueries({ queryKey: ["my-account"] });
          void queryClient.invalidateQueries({ queryKey: ["my-feed"] });
        },
        onError: (err) => {
          setError(err.message ?? "Unfollow failed");
        },
        onSettled: () => setIsUnfollowing(false),
      }
    );
  };

  return {
    unfollow,
    isUnfollowing: isUnfollowing || isPending,
    error,
  };
}
