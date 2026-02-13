"use client";

import { useState } from "react";
import Link from "next/link";
import {
  Heart,
  MessageCircle,
  Share2,
  Send,
  MoreHorizontal,
  Lock,
} from "lucide-react";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { ConnectButton } from "./ConnectButton";
import { cn } from "@/lib/utils";

export interface Comment {
  id: string;
  author: string;
  authorHandle: string;
  content: string;
  timestamp: string;
  avatar?: string;
}

export interface FeedPostProps {
  id: string;
  author: string;
  authorHandle: string;
  authorAvatar?: string;
  content: string;
  image?: string;
  video?: string;
  likes: number;
  comments: Comment[];
  timestamp: string;
  index?: number;
  isConnected?: boolean;
  column?: "left" | "right";
  communityId?: string;
  communityName?: string;
}

export function FeedPost({
  id,
  author,
  authorHandle,
  authorAvatar,
  content,
  image,
  video,
  likes: initialLikes,
  comments: initialComments,
  timestamp,
  index = 0,
  isConnected = false,
  column = "left",
  communityId,
  communityName,
}: FeedPostProps) {
  const [liked, setLiked] = useState(false);
  const [likes, setLikes] = useState(initialLikes);
  const [comments, setComments] = useState(initialComments);
  const [showComments, setShowComments] = useState(false);
  const [newComment, setNewComment] = useState("");
  const [showConnectOverlay, setShowConnectOverlay] = useState(false);

  const handleLike = () => {
    if (!isConnected) return;
    setLiked(!liked);
    setLikes((l) => (liked ? l - 1 : l + 1));
  };

  const handleAddComment = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newComment.trim() || !isConnected) return;
    setComments((c) => [
      ...c,
      {
        id: `c-${Date.now()}`,
        author: "You",
        authorHandle: "you",
        content: newComment.trim(),
        timestamp: "Just now",
      },
    ]);
    setNewComment("");
  };

  const handleCommentClick = () => {
    if (isConnected) {
      setShowComments(!showComments);
    } else {
      setShowConnectOverlay(true);
    }
  };

  const handlePostInteraction = () => {
    if (!isConnected) {
      setShowConnectOverlay(true);
    }
  };

  return (
    <div
      className="animate-feed-in overflow-visible"
      style={{ animationDelay: `${index * 80}ms` }}
    >
      <article
        className={cn(
          "glass-light rounded-2xl border border-white/15 relative",
          column === "left" ? "hover-zoom-left" : "hover-zoom-right",
          !isConnected && "cursor-pointer",
          !showConnectOverlay && "overflow-hidden"
        )}
        onClick={!isConnected ? handlePostInteraction : undefined}
        onMouseEnter={!isConnected ? () => setShowConnectOverlay(true) : undefined}
        onMouseLeave={!isConnected ? () => setShowConnectOverlay(false) : undefined}
      >
      {/* Content wrapper - ensures rounded corners clip properly */}
      <div className="overflow-hidden rounded-2xl">
      {/* Header */}
      <div
        className={cn(
          "flex items-center justify-between p-4",
          !image && !video && !isConnected && "rounded-b-2xl"
        )}
      >
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-full bg-gradient-to-br from-primary/40 to-primary overflow-hidden shrink-0 ring-2 ring-white/20 hover:ring-primary/50 transition-all duration-200">
            {authorAvatar ? (
              <img
                src={authorAvatar}
                alt={author}
                className="h-full w-full object-cover"
              />
            ) : (
              <div className="h-full w-full flex items-center justify-center text-lg font-bold text-primary-foreground">
                {author.charAt(0)}
              </div>
            )}
          </div>
          <div>
            <p className="font-semibold text-foreground">{author}</p>
            <p className="text-sm text-muted-foreground">
              @{authorHandle}
              {communityId && communityName ? (
                <>
                  {" · "}
                  <Link
                    href={`/community/${communityId}`}
                    className="hover:text-primary transition-colors"
                    onClick={(e) => e.stopPropagation()}
                  >
                    {communityName}
                  </Link>
                </>
              ) : (
                ".sui"
              )}
            </p>
          </div>
        </div>
        {isConnected && (
          <Button
            variant="ghost"
            size="icon"
            className="rounded-full hover:bg-white/10 transition-colors"
          >
            <MoreHorizontal className="h-5 w-5" />
          </Button>
        )}
      </div>

      {/* Image */}
      {image ? (
        <div className="aspect-video w-full overflow-hidden rounded-b-2xl bg-muted/30 group">
          <img
            src={image}
            alt=""
            loading="lazy"
            decoding="async"
            className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-[1.02]"
          />
        </div>
      ) : null}

      {/* Actions - only when connected */}
      {isConnected && (
        <div className={cn(
          "flex items-center gap-1 px-4 py-3 border-t border-white/10",
          !showComments && "rounded-b-2xl"
        )}>
          <Button
            variant="ghost"
            size="sm"
            className={cn(
              "gap-2 rounded-xl transition-all duration-200 hover:bg-white/5",
              liked ? "text-red-500 hover:text-red-400" : ""
            )}
            onClick={handleLike}
          >
            <Heart
              className={cn(
                "h-4 w-4 transition-transform hover:scale-110",
                liked ? "fill-current" : ""
              )}
            />
            <span>{likes}</span>
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="gap-2 rounded-xl transition-all duration-200 hover:bg-white/5"
            onClick={handleCommentClick}
          >
            <MessageCircle className="h-4 w-4" />
            <span>{comments.length}</span>
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="gap-2 rounded-xl hover:bg-white/5 transition-all duration-200"
          >
            <Share2 className="h-4 w-4 hover:scale-110 transition-transform" />
            <span>Share</span>
          </Button>
        </div>
      )}

      {/* Comments - only when connected */}
      {showComments && isConnected && (
        <div className="border-t border-white/10 p-4 space-y-4 animate-feed-slide rounded-b-2xl">
          <div className="space-y-3 max-h-48 overflow-y-auto">
            {comments.map((comment) => (
              <div key={comment.id} className="flex gap-3">
                <div className="h-8 w-8 rounded-full bg-muted shrink-0 flex items-center justify-center text-xs font-medium">
                  {comment.author.charAt(0)}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm">
                    <span className="font-medium">{comment.author}</span>
                    <span className="text-muted-foreground ml-1">
                      @{comment.authorHandle}
                    </span>
                  </p>
                  <p className="text-sm text-foreground/90 mt-0.5">
                    {comment.content}
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    {comment.timestamp}
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
              disabled={!newComment.trim()}
              className="hover-lift"
            >
              <Send className="h-4 w-4" />
            </Button>
          </form>
        </div>
      )}
      </div>

      {/* Connect overlay - when not connected and hovering/clicking (outside content wrapper so not clipped) */}
      {!isConnected && showConnectOverlay && (
        <div
          className="absolute inset-0 z-20 flex flex-col items-center justify-center gap-3 bg-black/60 backdrop-blur-sm animate-feed-slide rounded-2xl"
          onClick={(e) => e.stopPropagation()}
          onMouseDown={(e) => e.stopPropagation()}
        >
          <Lock className="h-7 w-7 text-white/90" />
          <div
            onMouseEnter={() => setShowConnectOverlay(true)}
          >
            <ConnectButton />
          </div>
        </div>
      )}
    </article>
    </div>
  );
}
