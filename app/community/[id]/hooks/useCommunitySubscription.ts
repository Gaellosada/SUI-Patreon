"use client";

import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useSignAndExecuteTransaction, useSuiClient } from "@mysten/dapp-kit";
import { Transaction } from "@mysten/sui/transactions";
import { useNetworkVariable } from "@/networkConfig";

export function useCommunitySubscription(communityId: string | undefined) {
  const [subscribeError, setSubscribeError] = useState<string | null>(null);
  const [cancelError, setCancelError] = useState<string | null>(null);
  const [pendingAction, setPendingAction] = useState<"follow" | "join" | "leave" | null>(null);
  const queryClient = useQueryClient();
  const { mutate: signAndExecute, isPending } = useSignAndExecuteTransaction();
  const isSubscribing = isPending;
  const suiClient = useSuiClient();
  const packageId = useNetworkVariable("artistPackageId");

  const follow = (priceMist: bigint) => {
    setSubscribeError(null);
    if (!communityId || !packageId) {
      setSubscribeError("Community or package not configured.");
      return;
    }
    setPendingAction("follow");

    const tx = new Transaction();
    const [payment] = tx.splitCoins(tx.gas, [priceMist]);

    tx.moveCall({
      target: `${packageId}::community::subscribe`,
      arguments: [tx.object(communityId), payment, tx.pure.u8(0)], // tier 0 = single follow price
    });

    signAndExecute(
      { transaction: tx },
      {
        onSuccess: async ({ digest }) => {
          await suiClient.waitForTransaction({ digest });
          setSubscribeError(null);
          setPendingAction(null);
          void queryClient.invalidateQueries({ queryKey: ["community", communityId] });
          void queryClient.invalidateQueries({ queryKey: ["creator-communities"] });
          void queryClient.invalidateQueries({ queryKey: ["my-feed"] });
          void queryClient.invalidateQueries({ queryKey: ["my-account"] });
        },
        onError: (err) => {
          setSubscribeError(err.message ?? "Follow failed");
          setPendingAction(null);
        },
      }
    );
  };

  const join = () => {
    setSubscribeError(null);
    if (!communityId || !packageId) {
      setSubscribeError("Community or package not configured.");
      return;
    }
    setPendingAction("join");

    const tx = new Transaction();
    tx.moveCall({
      target: `${packageId}::community::join_community`,
      arguments: [tx.object(communityId)],
    });

    signAndExecute(
      { transaction: tx },
      {
        onSuccess: async ({ digest }) => {
          await suiClient.waitForTransaction({ digest });
          setSubscribeError(null);
          setPendingAction(null);
          void queryClient.invalidateQueries({ queryKey: ["community", communityId] });
          void queryClient.invalidateQueries({ queryKey: ["creator-communities"] });
          void queryClient.invalidateQueries({ queryKey: ["my-feed"] });
          void queryClient.invalidateQueries({ queryKey: ["my-account"] });
        },
        onError: (err) => {
          const msg = err.message ?? "";
          setSubscribeError(
            msg.includes(", 0)") || msg.includes("EAlreadyMember")
              ? "Already a member"
              : err.message ?? "Join failed"
          );
          setPendingAction(null);
        },
      }
    );
  };

  const leave = () => {
    setSubscribeError(null);
    if (!communityId || !packageId) {
      setSubscribeError("Community or package not configured.");
      return;
    }
    setPendingAction("leave");

    const tx = new Transaction();
    tx.moveCall({
      target: `${packageId}::community::leave_community`,
      arguments: [tx.object(communityId)],
    });

    signAndExecute(
      { transaction: tx },
      {
        onSuccess: async ({ digest }) => {
          await suiClient.waitForTransaction({ digest });
          setSubscribeError(null);
          setPendingAction(null);
          void queryClient.invalidateQueries({ queryKey: ["community", communityId] });
          void queryClient.invalidateQueries({ queryKey: ["creator-communities"] });
          void queryClient.invalidateQueries({ queryKey: ["artist-page-viewer"] });
          void queryClient.invalidateQueries({ queryKey: ["my-feed"] });
          void queryClient.invalidateQueries({ queryKey: ["my-account"] });
        },
        onError: (err) => {
          const msg = err.message ?? "";
          setSubscribeError(
            msg.includes(", 3)") || msg.includes("ENotMember")
              ? "Not a member"
              : err.message ?? "Leave failed"
          );
          setPendingAction(null);
        },
      }
    );
  };

  const unfollow = (membershipId: string) => {
    setCancelError(null);
    if (!packageId) {
      setCancelError("Package not configured.");
      return;
    }

    const tx = new Transaction();
    tx.moveCall({
      target: `${packageId}::tier_seal::cancel_membership`,
      arguments: [tx.object(membershipId)],
    });

    signAndExecute(
      { transaction: tx },
      {
        onSuccess: async ({ digest }) => {
          await suiClient.waitForTransaction({ digest });
          setCancelError(null);
          void queryClient.invalidateQueries({ queryKey: ["community", communityId] });
          void queryClient.invalidateQueries({ queryKey: ["creator-communities"] });
          void queryClient.invalidateQueries({ queryKey: ["viewer-memberships"] });
          void queryClient.invalidateQueries({ queryKey: ["my-feed"] });
          void queryClient.invalidateQueries({ queryKey: ["my-account"] });
        },
        onError: (err) => {
          setCancelError(err.message ?? "Unfollow failed");
        },
      }
    );
  };

  return {
    follow,
    join,
    leave,
    unfollow,
    isSubscribing,
    pendingAction,
    subscribeError,
    cancelError,
  };
}
