"use client";

import { useState } from "react";
import Link from "next/link";
import {
  Loader2,
  Users,
  UserPlus,
  UsersRound,
  X,
  ChevronRight,
} from "lucide-react";
import { ConnectButton } from "../components/ConnectButton";
import { BackButton } from "../components/BackButton";
import { useConnection } from "../hooks/useConnection";
import { useMyAccount } from "../hooks/useMyAccount";

export default function MyAccountPage() {
  const { address, isConnected } = useConnection();
  const { data, isLoading } = useMyAccount(address ?? undefined);
  const [showFollowers, setShowFollowers] = useState(false);
  const [showFollowing, setShowFollowing] = useState(false);
  const [showCommunities, setShowCommunities] = useState(false);

  // Derive: people we follow = unique creators; communities = from those people
  const followingArtists = data
    ? [...new Map(data.following.filter((c) => c.creator).map((c) => [c.creator, c.creator])).values()]
    : [];
  const followingCommunities = data?.following ?? [];

  return (
    <main className="min-h-screen">
      <div
        className="w-full px-4 sm:px-6 lg:px-8 py-16 md:py-24"
        style={{
          background:
            "linear-gradient(to bottom, #0f172a 0%, #0e2035 25%, #0d2438 50%, #0b2d45 75%, #0c4a6e 100%)",
        }}
      >
        <div className="max-w-2xl mx-auto">
          <BackButton label="Back to feed" />

          <h1 className="text-3xl md:text-4xl font-bold text-white text-center mb-2">
            My Account
          </h1>
          <p className="text-muted-foreground text-center mb-12">
            Your followers, artists you follow, and their communities
          </p>

          {!isConnected ? (
            <div className="rounded-2xl glass-light border border-white/15 p-12 text-center">
              <p className="text-muted-foreground mb-6">
                Connect your wallet to view your account
              </p>
              <ConnectButton variant="dark" />
            </div>
          ) : isLoading ? (
            <div className="flex items-center justify-center gap-2 py-24 text-muted-foreground">
              <Loader2 className="h-6 w-6 animate-spin" />
              <span>Loading...</span>
            </div>
          ) : data ? (
            <div className="glass-light rounded-2xl p-8 border border-white/15 space-y-8">
              {/* Address */}
              <div>
                <p className="text-xs text-muted-foreground mb-1">Your address</p>
                <p className="font-mono text-sm text-foreground truncate">
                  {address}
                </p>
                <Link
                  href={`/creator/${address}`}
                  className="text-sm text-primary hover:underline mt-2 inline-block"
                >
                  View public profile →
                </Link>
              </div>

              {/* Stats - clickable */}
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                <button
                  onClick={() => data.isArtist && setShowFollowers(true)}
                  disabled={!data.isArtist}
                  className={`rounded-xl p-6 border transition-all text-left ${
                    data.isArtist
                      ? "bg-background/40 border-white/10 hover:border-white/25 hover:bg-background/60 cursor-pointer"
                      : "bg-background/20 border-white/5 cursor-default opacity-70"
                  }`}
                >
                  <div className="flex items-center gap-2 text-muted-foreground mb-2">
                    <Users className="h-5 w-5" />
                    <span className="text-sm">Followers</span>
                    {data.isArtist && (
                      <ChevronRight className="h-4 w-4 ml-auto" />
                    )}
                  </div>
                  <p className="text-2xl font-bold text-foreground">
                    {data.followers.length}
                  </p>
                  {!data.isArtist && (
                    <p className="text-xs text-muted-foreground mt-1">
                      Artists only
                    </p>
                  )}
                </button>

                <button
                  onClick={() => setShowFollowing(true)}
                  className="rounded-xl p-6 border border-white/10 bg-background/40 hover:border-white/25 hover:bg-background/60 transition-all text-left cursor-pointer"
                >
                  <div className="flex items-center gap-2 text-muted-foreground mb-2">
                    <UserPlus className="h-5 w-5" />
                    <span className="text-sm">Following</span>
                    <ChevronRight className="h-4 w-4 ml-auto" />
                  </div>
                  <p className="text-2xl font-bold text-foreground">
                    {followingArtists.length}
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Artists you follow
                  </p>
                </button>

                <button
                  onClick={() => setShowCommunities(true)}
                  className="rounded-xl p-6 border border-white/10 bg-background/40 hover:border-white/25 hover:bg-background/60 transition-all text-left cursor-pointer"
                >
                  <div className="flex items-center gap-2 text-muted-foreground mb-2">
                    <UsersRound className="h-5 w-5" />
                    <span className="text-sm">Communities</span>
                    <ChevronRight className="h-4 w-4 ml-auto" />
                  </div>
                  <p className="text-2xl font-bold text-foreground">
                    {followingCommunities.length}
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    You follow or joined
                  </p>
                </button>
              </div>

              {/* Role badge */}
              {data.isArtist && (
                <div className="rounded-lg bg-primary/15 px-4 py-2 inline-flex items-center gap-2">
                  <span className="text-sm font-medium text-primary">
                    Artist
                  </span>
                </div>
              )}
            </div>
          ) : null}
        </div>
      </div>

      {/* Followers modal */}
      {showFollowers && data && (
        <ListModal
          title="Followers"
          subtitle="People who joined your communities"
          items={data.followers.map((addr) => ({
            id: addr,
            label: `${addr.slice(0, 10)}...${addr.slice(-8)}`,
            href: `/creator/${addr}`,
          }))}
          onClose={() => setShowFollowers(false)}
        />
      )}

      {/* Following modal - artists/people */}
      {showFollowing && data && (
        <ListModal
          title="Following"
          subtitle="Artists you follow"
          items={followingArtists.map((creator) => ({
            id: creator,
            label: `${creator.slice(0, 10)}...${creator.slice(-8)}`,
            href: `/creator/${creator}`,
          }))}
          onClose={() => setShowFollowing(false)}
        />
      )}

      {/* Communities modal */}
      {showCommunities && data && (
        <ListModal
          title="Communities"
          subtitle="Communities you've joined or follow from artists you follow"
          items={followingCommunities.map((c) => ({
            id: c.id,
            label: c.name || "Unnamed",
            sublabel: c.creator ? `by ${c.creator.slice(0, 8)}...${c.creator.slice(-6)}` : undefined,
            href: `/community/${c.id}`,
          }))}
          onClose={() => setShowCommunities(false)}
        />
      )}
    </main>
  );
}

function ListModal({
  title,
  subtitle,
  items,
  onClose,
}: {
  title: string;
  subtitle: string;
  items: { id: string; label: string; sublabel?: string; href: string }[];
  onClose: () => void;
}) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center"
      onClick={onClose}
    >
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        aria-hidden
      />
      <div
        className="relative w-full max-w-md max-h-[70vh] glass-light rounded-t-2xl sm:rounded-2xl border border-white/15 overflow-hidden animate-feed-slide"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between p-4 border-b border-white/10">
          <div>
            <h2 className="text-lg font-semibold text-foreground">{title}</h2>
            <p className="text-sm text-muted-foreground">{subtitle}</p>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-white/10 transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="overflow-y-auto max-h-[50vh] p-4">
          {items.length === 0 ? (
            <p className="text-muted-foreground text-sm text-center py-8">
              No items yet
            </p>
          ) : (
            <div className="space-y-2">
              {items.map((item) => (
                <Link
                  key={item.id}
                  href={item.href}
                  className="block rounded-xl bg-background/40 border border-white/10 p-4 hover:border-white/20 hover:bg-background/60 transition-colors"
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <span className="font-medium text-foreground truncate block">
                        {item.label}
                      </span>
                      {item.sublabel && (
                        <span className="text-xs text-muted-foreground truncate block">
                          {item.sublabel}
                        </span>
                      )}
                    </div>
                    <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
