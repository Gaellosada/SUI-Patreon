"use client";

import { useEffect, useState } from "react";
import {
  getExtendedEphemeralPublicKey,
  jwtToAddress,
  genAddressSeed,
} from "@mysten/sui/zklogin";
import { Ed25519Keypair } from "@mysten/sui/keypairs/ed25519";
import { Loader2 } from "lucide-react";

const PROVER_URL = "https://prover-dev.mystenlabs.com/v1";
const SALT_STORAGE_KEY = "zk_login_salt";

function getOrCreateSalt(sub: string): string {
  const key = `${SALT_STORAGE_KEY}_${sub}`;
  let salt = typeof window !== "undefined" ? localStorage.getItem(key) : null;
  if (!salt) {
    const bytes = new Uint8Array(16);
    crypto.getRandomValues(bytes);
    salt = Array.from(bytes)
      .map((b) => b.toString().padStart(3, "0"))
      .join("")
      .slice(0, 39);
    if (typeof window !== "undefined") {
      localStorage.setItem(key, salt);
    }
  }
  return salt;
}

export default function AuthCallbackPage() {
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const params = new URLSearchParams(window.location.search);
    const hashParams = new URLSearchParams(window.location.hash?.slice(1) || "");
    const idToken = params.get("id_token") || hashParams.get("id_token") || "";

    if (!idToken) {
      setError("No token received");
      setTimeout(() => (window.location.href = "/"), 2000);
      return;
    }

    (async () => {
      try {
        const ephemeralKeyStr = sessionStorage.getItem("zk_ephemeral_key");
        const maxEpochStr = sessionStorage.getItem("zk_max_epoch");
        const randomnessStr = sessionStorage.getItem("zk_randomness");

        if (!ephemeralKeyStr || !maxEpochStr || !randomnessStr) {
          throw new Error("Session expired. Please try again.");
        }

        const ephemeralKeyPair = Ed25519Keypair.fromSecretKey(ephemeralKeyStr);
        const maxEpoch = parseInt(maxEpochStr, 10);
        const randomness = BigInt(randomnessStr);

        const decoded = JSON.parse(
          atob(idToken.split(".")[1] || "")
        ) as { sub?: string; iss?: string; aud?: string | string[] };
        const sub = decoded.sub;
        const aud = Array.isArray(decoded.aud) ? decoded.aud[0] : decoded.aud;

        if (!sub || !aud) throw new Error("Invalid JWT");

        const userSalt = getOrCreateSalt(sub);
        const zkAddress = jwtToAddress(idToken, BigInt(userSalt));

        const extendedEphemeralPublicKey = getExtendedEphemeralPublicKey(
          ephemeralKeyPair.getPublicKey()
        );

        const proofRes = await fetch(PROVER_URL, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            jwt: idToken,
            extendedEphemeralPublicKey: extendedEphemeralPublicKey.toString(),
            maxEpoch: maxEpoch.toString(),
            jwtRandomness: randomness.toString(),
            salt: userSalt,
            keyClaimName: "sub",
          }),
        });

        if (!proofRes.ok) {
          const errText = await proofRes.text();
          throw new Error(`Prover failed: ${errText}`);
        }

        const proof = await proofRes.json();
        const addressSeed = genAddressSeed(
          BigInt(userSalt),
          "sub",
          sub,
          aud
        ).toString();

        sessionStorage.setItem("zk_address", zkAddress);
        sessionStorage.setItem("zk_jwt", idToken);
        sessionStorage.setItem(
          "zk_proof",
          JSON.stringify({
            ...proof,
            addressSeed,
            maxEpoch,
          })
        );

        // Full reload so ZKLoginButton (in layout) remounts and reads sessionStorage
        window.location.href = "/";
      } catch (err) {
        setError(err instanceof Error ? err.message : "Login failed");
        setTimeout(() => (window.location.href = "/"), 3000);
      }
    })();
  }, []);

  return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-6">
      <div className="glass rounded-2xl p-12 flex flex-col items-center gap-4 max-w-md">
        {error ? (
          <>
            <p className="text-destructive text-center">{error}</p>
            <p className="text-sm text-muted-foreground">
              Redirecting you back...
            </p>
          </>
        ) : (
          <>
            <Loader2 className="h-12 w-12 animate-spin text-primary" />
            <p className="text-lg font-medium">Completing sign in...</p>
            <p className="text-sm text-muted-foreground text-center">
              Verifying your credentials with zero-knowledge proof
            </p>
          </>
        )}
      </div>
    </div>
  );
}
