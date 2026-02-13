"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { ConnectButton } from "./ConnectButton";
import { useIsArtist } from "@/hooks/useIsArtist";
import { useConnection } from "@/hooks/useConnection";

export default function Navbar() {
  const pathname = usePathname();
  const { address: ownerAddress, isConnected } = useConnection();
  const { isArtist } = useIsArtist(ownerAddress);
  const [isLightBg, setIsLightBg] = useState(true);

  useEffect(() => {
    if (pathname !== "/") {
      setIsLightBg(false);
      return;
    }
    const handleScroll = () => {
      const introHeight = window.innerHeight;
      const scrollY = window.scrollY;
      setIsLightBg(scrollY < introHeight * 0.5);
    };
    handleScroll();
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, [pathname]);

  const linkClass = (isLight: boolean) =>
    `text-sm font-medium transition-colors ${
      isLight ? "text-black/70 hover:text-black" : "text-white/80 hover:text-white"
    }`;

  return (
    <nav
      className="sticky top-0 z-50 border-b transition-all duration-300"
      style={{
        background: isLightBg
          ? "rgba(255, 255, 255, 0.75)"
          : "rgba(15, 23, 42, 0.75)",
        borderColor: isLightBg ? "rgba(0, 0, 0, 0.08)" : "rgba(255, 255, 255, 0.15)",
        backdropFilter: "blur(24px) saturate(180%)",
        WebkitBackdropFilter: "blur(24px) saturate(180%)",
      }}
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          <div className="flex items-center gap-6">
            <Link
              href="/"
              className="flex items-center hover:opacity-90 transition-opacity group"
            >
              <Image
                src="/logo-transparent.svg"
                alt="SUI Patreon"
                width={36}
                height={36}
                className="transition-transform duration-200 group-hover:scale-110"
              />
            </Link>
            {isConnected && (isArtist ? (
              <>
                <Link href="/create-community" className={linkClass(isLightBg)}>
                  Create Community
                </Link>
                <Link href="/create-post" className={linkClass(isLightBg)}>
                  Create Post
                </Link>
                <Link href="/poll" className={linkClass(isLightBg)}>
                  Poll
                </Link>
                <Link href="/my-feed" className={linkClass(isLightBg)}>
                  My feed
                </Link>
                <Link href="/my-account" className={linkClass(isLightBg)}>
                  My Account
                </Link>
              </>
            ) : (
              <>
                <Link href="/become-artist" className={linkClass(isLightBg)}>
                  Become Artist
                </Link>
                <Link href="/my-feed" className={linkClass(isLightBg)}>
                  My feed
                </Link>
                <Link href="/my-account" className={linkClass(isLightBg)}>
                  My Account
                </Link>
              </>
            ))}
          </div>

          <ConnectButton variant={isLightBg ? "light" : "dark"} />
        </div>
      </div>
    </nav>
  );
}
