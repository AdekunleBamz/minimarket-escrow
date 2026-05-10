import type { Address } from "viem";

export const MINIMARKET_ESCROW_MAINNET_CONTRACT = {
  // Mainnet fallback used when NEXT_PUBLIC_ESCROW_CONTRACT_ADDRESS is not set.
  address: "0x4b82B2b2c98674E29AF17d1bceB80C5142FA498c" as Address,
} as const;

export const CELO_MAINNET_USDM = {
  symbol: "USDm",
  decimals: 18,
  // Celo Mainnet USDm address used as the default MiniPay stablecoin.
  address: "0x765DE816845861e75A25fCA122bb6898B8B1282a" as Address,
} as const;

export const MINI_DEFAULT_STABLE_TOKEN = CELO_MAINNET_USDM;
