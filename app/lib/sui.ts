import { isValidSuiAddress } from "@mysten/sui/utils";

/** Check if string is a raw Sui wallet address (0x + 64 hex chars) */
export function isRawSuiAddress(value: string): boolean {
  const trimmed = value.trim();
  return trimmed.startsWith("0x") && isValidSuiAddress(trimmed);
}
