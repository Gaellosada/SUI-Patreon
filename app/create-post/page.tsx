"use client";

import { useState, useCallback, useEffect } from "react";
import Link from "next/link";
import {
  ImageIcon,
  Video,
  Loader2,
  Upload,
  X,
  Check,
} from "lucide-react";
import {
  useSignAndExecuteTransaction,
  useSuiClient,
} from "@mysten/dapp-kit";
import { Transaction } from "@mysten/sui/transactions";
import { Button } from "../components/ui/button";
import { ConnectButton } from "../components/ConnectButton";
import { ConnectWalletToInteract } from "../components/ConnectWalletToInteract";
import { BackButton } from "../components/BackButton";
import { useNetworkVariable } from "../networkConfig";
import { useCreatorCommunities } from "../hooks/useCreatorCommunities";
import { useConnection } from "../hooks/useConnection";

const CONTENT_TYPE_TEXT = 0;
const CONTENT_TYPE_IMAGE = 1;
const CONTENT_TYPE_VIDEO = 2;
const MAX_MEDIA_BASE64_BYTES = 50_000; // ~37KB image to stay under tx limits

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      resolve(result);
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

export default function CreatePostPage() {
  const { address: ownerAddress, isConnected, canSignTransactions } = useConnection();
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [communityId, setCommunityId] = useState("");
  const [caption, setCaption] = useState("");
  const [mediaFile, setMediaFile] = useState<File | null>(null);
  const [mediaPreview, setMediaPreview] = useState<string | null>(null);
  const [mediaUrl, setMediaUrl] = useState("");
  const [isDragging, setIsDragging] = useState(false);
  const [showDropSuccess, setShowDropSuccess] = useState(false);

  useEffect(() => {
    if (!showDropSuccess) return;
    const t = setTimeout(() => setShowDropSuccess(false), 1500);
    return () => clearTimeout(t);
  }, [showDropSuccess]);

  const packageId = useNetworkVariable("artistPackageId");
  const { data: communitiesData, isLoading: loadingCommunities } =
    useCreatorCommunities(ownerAddress || undefined);
  const ownedCommunities = communitiesData?.owned ?? [];

  const { mutate: signAndExecute, isPending } =
    useSignAndExecuteTransaction();
  const suiClient = useSuiClient();
  const hasPackageId = !!packageId?.trim();
  const canPost =
    isConnected &&
    hasPackageId &&
    communityId &&
    caption.trim() &&
    (mediaFile || mediaUrl || true);

  const clearMedia = useCallback(() => {
    setShowDropSuccess(false);
    setMediaFile((prev) => {
      setMediaPreview((p) => {
        if (p && p.startsWith("blob:")) URL.revokeObjectURL(p);
        return null;
      });
      return null;
    });
    setMediaUrl("");
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setIsDragging(false);
      const file = e.dataTransfer.files[0];
      if (!file) return;
      if (file.type.startsWith("image/") || file.type.startsWith("video/")) {
        clearMedia();
        setMediaFile(file);
        setMediaPreview(URL.createObjectURL(file));
        setShowDropSuccess(true);
      }
    },
    [clearMedia]
  );

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    if (!e.currentTarget.contains(e.relatedTarget as Node)) {
      setIsDragging(false);
    }
  }, []);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.type.startsWith("image/") || file.type.startsWith("video/")) {
      clearMedia();
      setMediaFile(file);
      setMediaPreview(URL.createObjectURL(file));
      setShowDropSuccess(true);
    }
    e.target.value = "";
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!hasPackageId || !communityId || !caption.trim()) {
      setError("Please select a community and add a caption.");
      return;
    }

    let contentType = CONTENT_TYPE_TEXT;
    let contentObj: { caption: string; media?: string; mediaType?: string } = {
      caption: caption.trim(),
    };

    if (mediaFile) {
      const isVideo = mediaFile.type.startsWith("video/");
      contentType = isVideo ? CONTENT_TYPE_VIDEO : CONTENT_TYPE_IMAGE;
      const base64 = await fileToBase64(mediaFile);
      const base64Data = base64.split(",")[1] ?? "";
      const sizeBytes = Math.ceil((base64Data.length * 3) / 4);
      if (sizeBytes > MAX_MEDIA_BASE64_BYTES) {
        setError(
          "File too large for on-chain storage. Use a smaller image or paste a URL (e.g. from Imgur, IPFS) in the media URL field."
        );
        return;
      }
      contentObj.media = base64;
      contentObj.mediaType = isVideo ? "video" : "image";
    } else if (mediaUrl.trim()) {
      const isVideo =
        /\.(mp4|webm|ogg|mov)(\?|$)/i.test(mediaUrl) ||
        mediaUrl.includes("youtube") ||
        mediaUrl.includes("vimeo");
      contentType = isVideo ? CONTENT_TYPE_VIDEO : CONTENT_TYPE_IMAGE;
      contentObj.media = mediaUrl.trim();
      contentObj.mediaType = isVideo ? "video" : "image";
    }

    const contentStr = JSON.stringify(contentObj);

    const tx = new Transaction();
    tx.moveCall({
      target: `${packageId}::community::create_post`,
      arguments: [
        tx.object(communityId),
        tx.pure.u8(contentType),
        tx.pure.string(contentStr),
      ],
    });

    signAndExecute(
      { transaction: tx },
      {
        onSuccess: async ({ digest }) => {
          await suiClient.waitForTransaction({ digest });
          setSuccess(true);
          setCaption("");
          clearMedia();
          setCommunityId("");
        },
        onError: (err) => {
          const msg = err.message ?? "Transaction failed";
          if (
            msg.includes("signTransactionBlock") ||
            msg.includes("No wallet") ||
            msg.includes("wallet") ||
            msg.includes("sign")
          ) {
            setError(
              "Connect a wallet (Sui Wallet, Ethos) to post. ZK Login cannot sign transactions."
            );
          } else {
            setError(msg);
          }
        },
      }
    );
  };

  if (success) {
    return (
      <main className="min-h-screen">
        <div className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
          <BackButton label="Back to feed" />
          <div className="glass-light rounded-2xl p-8 md:p-12 border border-white/15 text-center animate-feed-in">
            <div className="inline-flex justify-center w-16 h-16 rounded-full bg-primary/20 text-primary mb-6">
              <Upload className="h-8 w-8" />
            </div>
            <h1 className="text-2xl font-semibold text-foreground mb-2">
              Post created!
            </h1>
            <p className="text-muted-foreground mb-8 max-w-md mx-auto">
              Your post is live in the community. Members can now see and
              engage with it.
            </p>
            <div className="flex gap-4 justify-center">
              <Link href="/">
                <Button
                  variant="default"
                  size="lg"
                  className="bg-blue-800 hover:bg-blue-700 text-white"
                >
                  Back to feed
                </Button>
              </Link>
              <Button
                variant="outline"
                size="lg"
                onClick={() => setSuccess(false)}
                className="border-white/20"
              >
                Create another
              </Button>
            </div>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen">
      <div className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <BackButton label="Back to feed" />

        <div className="glass-light rounded-2xl p-8 md:p-12 border border-white/15 animate-feed-in">
          <div className="text-center mb-8">
            <div className="inline-flex justify-center w-14 h-14 rounded-xl glass border border-white/15 mb-4">
              <Upload className="h-7 w-7 text-primary" />
            </div>
            <h1 className="text-2xl font-semibold text-foreground mb-2">
              Create a post
            </h1>
            <p className="text-muted-foreground text-sm max-w-md mx-auto">
              Post an image or video with a caption to one of your communities.
              Only community creators can post.
            </p>
          </div>

          {!isConnected ? (
            <div className="rounded-xl glass-subtle border border-white/10 p-6 text-center">
              <p className="text-sm text-muted-foreground mb-4">
                Connect to create a post
              </p>
              <ConnectButton />
            </div>
          ) : !canSignTransactions ? (
            <ConnectWalletToInteract action="create posts" />
          ) : (
            <form onSubmit={handleSubmit} className="space-y-6">
              {/* Community selector */}
              <div>
                <label className="block text-sm font-medium text-foreground mb-2">
                  Community *
                </label>
                <select
                  value={communityId}
                  onChange={(e) => setCommunityId(e.target.value)}
                  className="w-full rounded-xl bg-background/60 border border-white/15 px-4 py-3 text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
                  required
                >
                  <option value="">Select a community...</option>
                  {loadingCommunities ? (
                    <option disabled>Loading...</option>
                  ) : (
                    ownedCommunities.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name || "Unnamed"} ({c.id.slice(0, 8)}...)
                      </option>
                    ))
                  )}
                </select>
                {!loadingCommunities && ownedCommunities.length === 0 && (
                  <p className="text-sm text-muted-foreground mt-2">
                    You have no communities.{" "}
                    <Link
                      href="/create-community"
                      className="text-primary hover:underline"
                    >
                      Create one first
                    </Link>
                    .
                  </p>
                )}
              </div>

              {/* Caption */}
              <div>
                <label className="block text-sm font-medium text-foreground mb-2">
                  Caption *
                </label>
                <textarea
                  value={caption}
                  onChange={(e) => setCaption(e.target.value)}
                  placeholder="What's on your mind?"
                  rows={4}
                  className="w-full rounded-xl bg-background/60 border border-white/15 px-4 py-3 text-foreground placeholder:text-muted-foreground/60 focus:outline-none focus:ring-2 focus:ring-primary/50 resize-none"
                  required
                />
              </div>

              {/* Drag & drop media */}
              <div>
                <label className="block text-sm font-medium text-foreground mb-2">
                  Image or video (optional)
                </label>
                <div
                  onDragOver={(e) => {
                    e.preventDefault();
                    e.dataTransfer.dropEffect = "copy";
                    setIsDragging(true);
                  }}
                  onDragLeave={handleDragLeave}
                  onDrop={handleDrop}
                  className={`relative rounded-xl border-2 border-dashed transition-all duration-300 ${
                    isDragging
                      ? "border-primary/50 bg-primary/10 scale-[1.02]"
                      : "border-white/20 hover:border-white/30"
                  } p-8 text-center overflow-hidden`}
                >
                  <input
                    type="file"
                    accept="image/*,video/*"
                    onChange={handleFileSelect}
                    className={`absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10 ${
                      mediaPreview ? "pointer-events-none" : ""
                    }`}
                  />
                  {showDropSuccess && (
                    <div className="absolute inset-0 z-20 flex flex-col items-center justify-center bg-primary/20 backdrop-blur-sm animate-drop-success">
                      <div className="flex items-center justify-center w-14 h-14 rounded-full bg-primary/30 border-2 border-primary/60 mb-2">
                        <Check className="h-8 w-8 text-primary" strokeWidth={2.5} />
                      </div>
                      <span className="text-sm font-medium text-primary">Added!</span>
                    </div>
                  )}
                  {mediaPreview ? (
                    <div className="relative animate-feed-in">
                      {mediaFile?.type.startsWith("video/") ? (
                        <video
                          src={mediaPreview}
                          controls
                          className="max-h-64 mx-auto rounded-lg"
                        />
                      ) : (
                        <img
                          src={mediaPreview}
                          alt="Preview"
                          className="max-h-64 mx-auto rounded-lg object-contain"
                        />
                      )}
                      <button
                        type="button"
                        onClick={(e) => {
                          e.preventDefault();
                          clearMedia();
                        }}
                        className="absolute -top-2 -right-2 p-1.5 rounded-full bg-destructive/90 text-white hover:bg-destructive"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    </div>
                  ) : (
                    <>
                      <div className="flex justify-center gap-4 mb-2">
                        <ImageIcon className="h-10 w-10 text-muted-foreground" />
                        <Video className="h-10 w-10 text-muted-foreground" />
                      </div>
                      <p className="text-sm text-muted-foreground">
                        Drag and drop an image or video, or click to browse
                      </p>
                    </>
                  )}
                </div>
                <p className="text-xs text-muted-foreground mt-2">
                  Or paste a URL (Imgur, IPFS, etc.):
                </p>
                <input
                  type="url"
                  value={mediaUrl}
                  onChange={(e) => setMediaUrl(e.target.value)}
                  placeholder="https://..."
                  className="mt-1 w-full rounded-lg bg-background/60 border border-white/10 px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground/60 focus:outline-none focus:ring-2 focus:ring-primary/50"
                />
              </div>

              {error && (
                <div className="rounded-xl bg-destructive/15 border border-destructive/30 p-4">
                  <p className="text-sm text-destructive">{error}</p>
                </div>
              )}

              <Button
                type="submit"
                variant="default"
                size="lg"
                className="w-full bg-blue-800 hover:bg-blue-700 text-white"
                disabled={
                  isPending ||
                  !hasPackageId ||
                  !communityId ||
                  !caption.trim() ||
                  ownedCommunities.length === 0
                }
              >
                {isPending ? (
                  <>
                    <Loader2 className="h-5 w-5 animate-spin" />
                    Posting...
                  </>
                ) : (
                  "Create post"
                )}
              </Button>
            </form>
          )}
        </div>
      </div>
    </main>
  );
}
