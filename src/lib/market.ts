import type { Address } from "viem";

/** Mainnet fallback contract used when NEXT_PUBLIC_ESCROW_CONTRACT_ADDRESS is not set. */
export const MINIMARKET_ESCROW_MAINNET_CONTRACT = {
  address: "0x4b82B2b2c98674E29AF17d1bceB80C5142FA498c" as Address,
} as const;

/** Celo Mainnet USDm token descriptor used as the default MiniPay stablecoin. */
export const CELO_MAINNET_USDM = {
  symbol: "USDm",
  decimals: 18,
  address: "0x765DE816845861e75A25fCA122bb6898B8B1282a" as Address,
} as const;

/** Celo Mainnet USDC token descriptor for multi-stable escrow support. */
export const CELO_MAINNET_USDC = {
  symbol: "USDC",
  decimals: 6,
  address: "0xcebA9300f2b948710d2653dD7B07f33A8B32118C" as Address,
} as const;

/** Default stable token for MiniMarket Escrow stablecoin funding paths. */
export const MINI_DEFAULT_STABLE_TOKEN = CELO_MAINNET_USDM;
