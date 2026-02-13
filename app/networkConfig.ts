import { getFullnodeUrl } from "@mysten/sui/client";
import { createNetworkConfig } from "@mysten/dapp-kit";

const { networkConfig, useNetworkVariable, useNetworkVariables } =
  createNetworkConfig({
    devnet: {
      url: getFullnodeUrl("devnet"),
      variables: {
        artistPackageId: process.env.NEXT_PUBLIC_ARTIST_PACKAGE_ID ?? "",
        artistFeeRecipient: process.env.NEXT_PUBLIC_ARTIST_FEE_RECIPIENT ?? "",
      },
    },
    testnet: {
      url: getFullnodeUrl("testnet"),
      variables: {
        artistPackageId: process.env.NEXT_PUBLIC_ARTIST_PACKAGE_ID ?? "",
        artistFeeRecipient: process.env.NEXT_PUBLIC_ARTIST_FEE_RECIPIENT ?? "",
      },
    },
    mainnet: {
      url: getFullnodeUrl("mainnet"),
      variables: {
        artistPackageId: process.env.NEXT_PUBLIC_ARTIST_PACKAGE_ID ?? "",
        artistFeeRecipient: process.env.NEXT_PUBLIC_ARTIST_FEE_RECIPIENT ?? "",
      },
    },
  });

export { useNetworkVariable, useNetworkVariables, networkConfig };
