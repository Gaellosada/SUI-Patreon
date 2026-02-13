"use client";

import { useState } from "react";
import Link from "next/link";
import {
  Heart,
  MessageCircle,
  Send,
  Loader2,
  Lock,
} from "lucide-react";
import { useSignAndExecuteTransaction } from "@mysten/dapp-kit";
import { Transaction } from "@mysten/sui/transactions";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { ConnectButton } from "./ConnectButton";
import { ConnectWalletToInteract } from "./ConnectWalletToInteract";
import { useNetworkVariable } from "@/networkConfig";
import { useQueryClient } from "@tanstack/react-query";
import type { FeedPost } from "@/hooks/useMyFeed";
import { cn } from "@/lib/utils";

const CONTENT_TYPE_TEXT = 0;
const CONTENT_TYPE_IMAGE = 1;
const CONTENT_TYPE_VIDEO = 2;

function formatTimeAgo(ms: number): string {
  if (!ms) return "";
  const sec = Math.floor((Date.now() - ms) / 1000);
  if (sec < 60) return "Just now";
  if (sec < 3600) return `${Math.floor(sec / 60)}m ago`;
  if (sec < 86400) return `${Math.floor(sec / 3600)}h ago`;
  return `${Math.floor(sec / 86400)}d ago`;
}

function parseContent(content: string): { caption?: string; media?: string; mediaType?: string } {
  try {
    return JSON.parse(content) as { caption?: string; media?: string; mediaType?: string };
  } catch {
    return { caption: content };
  }
}

export function MyFeedPost({
  post,
  viewerAddress,
  canSign,
  index = 0,
}: {
  post: FeedPost;
  viewerAddress: string | undefined;
  canSign: boolean;
  index?: number;
}) {
  const packageId = useNetworkVariable("artistPackageId");
  const queryClient = useQueryClient();
  const { mutate: signAndExecute, isPending } = useSignAndExecuteTransaction();

  const [showComments, setShowComments] = useState(false);
  const [newComment, setNewComment] = useState("");
  const [showConnectOverlay, setShowConnectOverlay] = useState(false);

  const liked = viewerAddress ? post.likedBy.includes(viewerAddress) : false;
  const parsed = parseContent(post.content);
  const caption = parsed.caption ?? post.content;
  const mediaUrl = parsed.media;
  const mediaType = parsed.mediaType ?? "image";
  const isTierGated = post.contentKey.length > 0;

  const refreshFeed = () => {
    queryClient.invalidateQueries({ queryKey: ["my-feed"] });
  };

  const handleLike = () => {
    if (!canSign || !packageId || !viewerAddress) return;

    const tx = new Transaction();
    if (liked) {
      tx.moveCall({
        target: `${packageId}::community::unlike_post`,
        arguments: [tx.object(post.communityId), tx.pure.u64(post.postId)],
      });
    } else {
      tx.moveCall({
        target: `${packageId}::community::like_post`,
        arguments: [tx.object(post.communityId), tx.pure.u64(post.postId)],
      });
    }

    signAndExecute(
      { transaction: tx },
      {
        onSuccess: () => refreshFeed(),
        onError: (err) => console.error("Like failed:", err),
      }
    );
  };

  const handleAddComment = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newComment.trim() || !canSign || !packageId) return;

    const tx = new Transaction();
    tx.moveCall({
      target: `${packageId}::community::leave_comment`,
      arguments: [
        tx.object(post.communityId),
        tx.pure.u64(post.postId),
        tx.pure.string(newComment.trim()),
      ],
    });

    signAndExecute(
      { transaction: tx },
      {
        onSuccess: () => {
          setNewComment("");
          refreshFeed();
        },
        onError: (err) => console.error("Comment failed:", err),
      }
    );
  };

  const handleCommentClick = () => {
    if (canSign) {
      setShowComments(!showComments);
    } else {
      setShowConnectOverlay(true);
    }
  };

  const handlePostInteraction = () => {
    if (!canSign) setShowConnectOverlay(true);
  };

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
        onClick={!canSign ? handlePostInteraction : undefined}
        onMouseEnter={!canSign ? () => setShowConnectOverlay(true) : undefined}
        onMouseLeave={!canSign ? () => setShowConnectOverlay(false) : undefined}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4">
          <div className="flex items-center gap-3">
            <Link
              href={`/creator/${post.author}`}
              className="h-10 w-10 rounded-full bg-gradient-to-br from-primary/40 to-primary flex items-center justify-center text-lg font-bold text-primary-foreground shrink-0 ring-2 ring-white/20 hover:ring-primary/50 transition-all"
            >
              {post.author.charAt(0).toUpperCase()}
            </Link>
            <div>
              <Link
                href={`/creator/${post.author}`}
                className="font-semibold text-foreground hover:text-primary"
              >
                {post.author.slice(0, 8)}...{post.author.slice(-6)}
              </Link>
              <Link
                href={`/community/${post.communityId}`}
                className="block text-sm text-muted-foreground hover:text-primary"
              >
                in {post.communityName || "Community"}
              </Link>
            </div>
          </div>
        </div>

        {/* Content */}
        {isTierGated ? (
          <div className="px-4 pb-4">
            <div className="flex items-center gap-2 py-4 rounded-lg bg-primary/10 border border-primary/20">
              <Lock className="h-5 w-5 text-primary shrink-0" />
              <p className="text-sm text-muted-foreground">
                Exclusive content — follow to unlock
              </p>
            </div>
          </div>
        ) : (
          <>
            {mediaUrl && (
              <div className="aspect-video w-full overflow-hidden bg-muted/30">
                {mediaType === "video" ? (
                  <video
                    src={mediaUrl}
                    controls
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <img
                    src={mediaUrl}
                    alt=""
                    className="w-full h-full object-cover"
                  />
                )}
              </div>
            )}
            {caption && (
              <p className="px-4 py-3 text-foreground text-sm whitespace-pre-wrap break-words">
                {caption}
              </p>
            )}
          </>
        )}

        {/* Actions */}
        {canSign && (
          <div
            className={cn(
              "flex items-center gap-1 px-4 py-3 border-t border-white/10",
              !showComments && "rounded-b-2xl"
            )}
          >
            <Button
              variant="ghost"
              size="sm"
              className={cn(
                "gap-2 rounded-xl transition-all hover:bg-white/5",
                liked && "text-red-500 hover:text-red-400"
              )}
              onClick={handleLike}
              disabled={isPending}
            >
              {isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Heart
                  className={cn(
                    "h-4 w-4 transition-transform hover:scale-110",
                    liked && "fill-current"
                  )}
                />
              )}
              <span>{post.likeCount}</span>
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="gap-2 rounded-xl transition-all hover:bg-white/5"
              onClick={handleCommentClick}
            >
              <MessageCircle className="h-4 w-4" />
              <span>{post.comments.length}</span>
            </Button>
          </div>
        )}

        {/* Comments */}
        {showComments && canSign && (
          <div className="border-t border-white/10 p-4 space-y-4 animate-feed-slide rounded-b-2xl">
            <div className="space-y-3 max-h-48 overflow-y-auto">
              {post.comments.map((c, i) => (
                <div key={i} className="flex gap-3">
                  <div className="h-8 w-8 rounded-full bg-muted shrink-0 flex items-center justify-center text-xs font-medium">
                    {c.author.slice(0, 1).toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm">
                      <Link
                        href={`/creator/${c.author}`}
                        className="font-medium hover:text-primary"
                      >
                        {c.author.slice(0, 8)}...{c.author.slice(-6)}
                      </Link>
                    </p>
                    <p className="text-sm text-foreground/90 mt-0.5">{c.content}</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      {formatTimeAgo(c.timestampMs)}
                    </p>
                  </div>
                </div>
              ))}
            </div>
            <form onSubmit={handleAddComment} className="flex gap-2">
              <Input
                placeholder="Add a comment..."
                value={newComment}
                onChange={(e) => setNewComment(e.target.value)}
                className="flex-1"
              />
              <Button
                type="submit"
                size="icon"
                disabled={!newComment.trim() || isPending}
              >
                <Send className="h-4 w-4" />
              </Button>
            </form>
          </div>
        )}

        {/* Connect overlay */}
        {!canSign && showConnectOverlay && (
          <div
            className="absolute inset-0 z-20 flex flex-col items-center justify-center gap-3 bg-black/60 backdrop-blur-sm animate-feed-slide rounded-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <Lock className="h-7 w-7 text-white/90" />
            {viewerAddress ? (
              <ConnectWalletToInteract action="like and comment" />
            ) : (
              <ConnectButton variant="dark" />
            )}
          </div>
        )}
      </article>
    </div>
  );
}
