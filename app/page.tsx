"use client";

import { useEffect, useState } from "react";
import { useCurrentAccount } from "@mysten/dapp-kit";
import { SuiNSearchBar } from "./components/SuiNSearchBar";
import { FeedPost } from "./components/FeedPost";
import { IntroSection } from "./components/IntroSection";
import { TrendingSection } from "./components/TrendingSection";
import { SearchBarSection } from "./components/SearchBarSection";

const MOCK_POSTS = [
  {
    id: "0",
    author: "Emily",
    authorHandle: "emily.sui",
    content:
      "Night by the water. This is where I find my inspiration. New content coming to Sui soon — stay tuned. ✨\n\n#Sui #CreatorEconomy #emily.sui",
    image: "/emily.png",
    video: undefined,
    likes: 178,
    comments: [
      {
        id: "c0a",
        author: "SuiFan",
        authorHandle: "suifan",
        content: "So excited for what's next!",
        timestamp: "1h ago",
      },
    ],
    timestamp: "2h ago",
  },
  {
    id: "0b",
    author: "Marcus Reed",
    authorHandle: "marcus.creates",
    content:
      "Between breaths. Where the work happens. New visual series coming to Sui — diving deep into what moves us. 🌊\n\n#Sui #CreatorEconomy #ArtOnSui",
    image: "/artist-pool.png",
    video: undefined,
    likes: 89,
    comments: [],
    timestamp: "4h ago",
  },
  {
    id: "0c",
    author: "Cindy",
    authorHandle: "cindy.sui",
    content:
      "Sunny days and good vibes only ☀️ So excited to be building my community on Sui — drop a ✨ if you're here for the ride!\n\n#Sui #cindy.sui #CreatorEconomy",
    image: "/cindy-sui.png",
    video: undefined,
    likes: 234,
    comments: [
      {
        id: "c0c",
        author: "SuiFan",
        authorHandle: "suifan",
        content: "Love your energy! 🔥",
        timestamp: "30m ago",
      },
    ],
    timestamp: "3h ago",
  },
  {
    id: "5",
    author: "Sui Foundation",
    authorHandle: "sui",
    content:
      "Hackathon season is here! 🚀 Build the future of web3 on Sui. Prizes, mentorship, and a chance to shape the ecosystem.",
    image: "/sui-ceo.png",
    video: undefined,
    likes: 312,
    comments: [
      {
        id: "c5",
        author: "BuilderBob",
        authorHandle: "builderbob",
        content: "Already building! So excited",
        timestamp: "2h ago",
      },
      {
        id: "c6",
        author: "Web3Wendy",
        authorHandle: "wendy",
        content: "What's the deadline?",
        timestamp: "1h ago",
      },
    ],
    timestamp: "1d ago",
  },
];

export default function Home() {
  const currentAccount = useCurrentAccount();
  const [zkAddress, setZkAddress] = useState<string | null>(null);

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

  const isConnected = !!currentAccount || !!zkAddress;

  return (
    <main className="min-h-screen">
      {/* 1. Intro - "Be yourself, follow your art." */}
      <IntroSection />

      {/* Bridge: seamless Intro (#7e8fa0) → Trending (#7e8fa0) */}
      <div
        className="h-16 md:h-24 shrink-0"
        style={{ background: "#7e8fa0" }}
        aria-hidden
      />

      {/* 2. Trending creators - huge heading, blue background */}
      <TrendingSection />

      {/* Bridge: Trending → Posts — same hue family */}
      <div
        className="h-32 md:h-40 lg:h-52 shrink-0"
        style={{ background: "#0f172a" }}
        aria-hidden
      />

      {/* 3. Posts feed — full-width gradient, no transparent (avoids body showing on sides) */}
      <div
        className="snap-section w-full px-4 sm:px-6 lg:px-8 py-32 md:py-44"
        style={{
          background:
            "linear-gradient(to bottom, #0f172a 0%, #0e2035 25%, #0d2438 50%, #0e2035 75%, #0f172a 100%)",
        }}
      >
        <div className="max-w-6xl mx-auto">
          <div className="widget-grid grid grid-cols-1 md:grid-cols-2 gap-8 md:gap-10 overflow-visible">
            {[...MOCK_POSTS]
              .sort((a, b) => b.likes - a.likes)
              .map((post, i) => (
                <FeedPost
                  key={post.id}
                  {...post}
                  index={i}
                  isConnected={isConnected}
                  column={i % 2 === 0 ? "left" : "right"}
                />
              ))}
          </div>
        </div>
      </div>

      {/* Bridge: Posts → Search — consistent navy */}
      <div
        className="h-32 md:h-40 lg:h-48 shrink-0"
        style={{
          background:
            "linear-gradient(to bottom, #0f172a 0%, #0e2035 50%, #0f172a 100%)",
        }}
        aria-hidden
      />

      {/* 4. Search bar at the end - with animated background */}
      <SearchBarSection isConnected={isConnected} />
    </main>
  );
}
