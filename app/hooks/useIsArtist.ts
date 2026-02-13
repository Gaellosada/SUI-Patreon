"use client";

import { useSuiClientQuery } from "@mysten/dapp-kit";
import { useNetworkVariable } from "@/networkConfig";

/**
 * Detects if the connected address is a registered artist.
 * Artists have ArtistCap (and ArtistCommunities) from register_as_artist.
 * Subscriber only = connected but no ArtistCap.
 */
export function useIsArtist(address: string | undefined) {
  const packageId = useNetworkVariable("artistPackageId");

  const { data: ownedObjects, isLoading } = useSuiClientQuery(
    "getOwnedObjects",
    {
      owner: address ?? "",
      options: { showContent: true },
    },
    { enabled: !!address }
  );

  const isArtist =
    !!packageId &&
    !!ownedObjects?.data?.some(
      (o) =>
        o.data?.content?.dataType === "moveObject" &&
        (o.data.content as { type: string }).type?.includes(
          "::artist::ArtistCap"
        )
    );

  return { isArtist, isLoading: isLoading && !!address };
}
