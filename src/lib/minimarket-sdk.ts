import {
  erc20Abi,
  getAddress,
  isAddress,
  keccak256,
  parseUnits,
  stringToBytes,
  type Address,
  type Hex,
  type WalletClient,
} from "viem";

export const MINI_CHAIN = {
  mainnet: {
    id: 42220,
    name: "Celo",
    rpcUrl: "https://forno.celo.org",
    explorerUrl: "https://celoscan.io",
  },
  sepolia: {
    id: 11142220,
    name: "Celo Sepolia",
    rpcUrl: "https://forno.celo-sepolia.celo-testnet.org",
    explorerUrl: "https://sepolia.celoscan.io",
  },
} as const;

export const MINI_STABLECOINS = {
  USDm: {
    symbol: "USDm",
    decimals: 18,
    address: "0x765DE816845861e75A25fCA122bb6898B8B1282a" as Address,
  },
  USDC: {
    symbol: "USDC",
    decimals: 6,
    address: "0xcebA9300f2b948710d2653dD7B07f33A8B32118C" as Address,
  },
  USDT: {
    symbol: "USDT",
    decimals: 6,
    address: "0x48065fbbe25f71c9282ddf5e1cd6d6a887483d5e" as Address,
  },
} as const;

export type EscrowTokenSymbol = keyof typeof MINI_STABLECOINS | "CELO";

export type EscrowStatus =
  | "None"
  | "Funded"
  | "Released"
  | "Refunded"
  | "Disputed"
  | "ResolvedToSeller"
  | "ResolvedToBuyer";

export function assertAddress(value: string | undefined | null, label = "address"): Address {
  if (!value || !isAddress(value)) {
    throw new Error(`${label} is not a valid EVM address`);
  }

  return getAddress(value);
}

export function normalizeText(value: string | undefined | null, fallback = ""): string {
  return (value ?? fallback).replace(/\s+/g, " ").trim().slice(0, 180);
}

export function normalizeAmount(value: string): string {
  const normalized = value.replace(/,/g, "").trim();
  if (!/^\d+(\.\d{1,18})?$/.test(normalized)) {
    throw new Error("Enter a valid amount");
  }

  if (Number(normalized) <= 0) {
    throw new Error("Amount must be greater than zero");
  }

  return normalized;
}

export function decimalsForSymbol(symbol: EscrowTokenSymbol): number {
  if (symbol === "CELO") return 18;
  return MINI_STABLECOINS[symbol].decimals;
}

export function parseEscrowAmount(amount: string, symbol: EscrowTokenSymbol): bigint {
  return parseUnits(normalizeAmount(amount), decimalsForSymbol(symbol));
}

export function createDealHash(input: {
  buyer: string;
  seller: string;
  label: string;
  amount: string;
  symbol: EscrowTokenSymbol;
}): Hex {
  const payload = [
    "mini-market-escrow-v1",
    input.buyer.toLowerCase(),
    input.seller.toLowerCase(),
    normalizeText(input.label, "Escrow deal").toLowerCase(),
    normalizeAmount(input.amount),
    input.symbol,
  ].join("|");

  return keccak256(stringToBytes(payload));
}

export const MINI_MARKET_ESCROW_ABI = [
  {
    type: "constructor",
    inputs: [{ name: "initialOwner_", type: "address", internalType: "address" }],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "createNativeEscrow",
    inputs: [
      { name: "seller", type: "address", internalType: "address" },
      { name: "arbiter", type: "address", internalType: "address" },
      { name: "dealHash", type: "bytes32", internalType: "bytes32" },
    ],
    outputs: [{ name: "escrowId", type: "uint256", internalType: "uint256" }],
    stateMutability: "payable",
  },
  {
    type: "function",
    name: "createTokenEscrow",
    inputs: [
      { name: "seller", type: "address", internalType: "address" },
      { name: "arbiter", type: "address", internalType: "address" },
      { name: "token", type: "address", internalType: "address" },
      { name: "amount", type: "uint256", internalType: "uint256" },
      { name: "dealHash", type: "bytes32", internalType: "bytes32" },
    ],
    outputs: [{ name: "escrowId", type: "uint256", internalType: "uint256" }],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "release",
    inputs: [{ name: "escrowId", type: "uint256", internalType: "uint256" }],
    outputs: [],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "refund",
    inputs: [{ name: "escrowId", type: "uint256", internalType: "uint256" }],
    outputs: [],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "openDispute",
    inputs: [{ name: "escrowId", type: "uint256", internalType: "uint256" }],
    outputs: [],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "resolveDispute",
    inputs: [
      { name: "escrowId", type: "uint256", internalType: "uint256" },
      { name: "releaseToSeller", type: "bool", internalType: "bool" },
    ],
    outputs: [],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "escrows",
    inputs: [{ name: "escrowId", type: "uint256", internalType: "uint256" }],
    outputs: [
      { name: "buyer", type: "address", internalType: "address" },
      { name: "seller", type: "address", internalType: "address" },
      { name: "arbiter", type: "address", internalType: "address" },
      { name: "token", type: "address", internalType: "address" },
      { name: "amount", type: "uint256", internalType: "uint256" },
      { name: "dealHash", type: "bytes32", internalType: "bytes32" },
      { name: "createdAt", type: "uint64", internalType: "uint64" },
      { name: "status", type: "uint8", internalType: "enum MiniMarketEscrow.EscrowStatus" },
    ],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "marketSnapshot",
    inputs: [{ name: "token", type: "address", internalType: "address" }],
    outputs: [
      { name: "escrowCount", type: "uint256", internalType: "uint256" },
      { name: "closedCount", type: "uint256", internalType: "uint256" },
      { name: "nativeTvl", type: "uint256", internalType: "uint256" },
      { name: "nativeVolume", type: "uint256", internalType: "uint256" },
      { name: "tokenTvl", type: "uint256", internalType: "uint256" },
      { name: "tokenVolume", type: "uint256", internalType: "uint256" },
    ],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "totalEscrows",
    inputs: [],
    outputs: [{ name: "", type: "uint256", internalType: "uint256" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "totalClosedEscrows",
    inputs: [],
    outputs: [{ name: "", type: "uint256", internalType: "uint256" }],
    stateMutability: "view",
  },
  { type: "receive", stateMutability: "payable" },
] as const;

export async function approveEscrowToken(input: {
  walletClient: WalletClient;
  tokenAddress: Address;
  escrowAddress: Address;
  amount: bigint;
}) {
  const [account] = await input.walletClient.getAddresses();
  return input.walletClient.writeContract({
    account,
    chain: input.walletClient.chain,
    address: input.tokenAddress,
    abi: erc20Abi,
    functionName: "approve",
    args: [input.escrowAddress, input.amount],
  });
}

export async function createNativeEscrow(input: {
  walletClient: WalletClient;
  escrowAddress: Address;
  seller: Address;
  arbiter: Address;
  dealHash: Hex;
  amount: bigint;
}) {
  const [account] = await input.walletClient.getAddresses();
  return input.walletClient.writeContract({
    account,
    chain: input.walletClient.chain,
    address: input.escrowAddress,
    abi: MINI_MARKET_ESCROW_ABI,
    functionName: "createNativeEscrow",
    args: [input.seller, input.arbiter, input.dealHash],
    value: input.amount,
  });
}

export async function createTokenEscrow(input: {
  walletClient: WalletClient;
  escrowAddress: Address;
  seller: Address;
  arbiter: Address;
  tokenAddress: Address;
  dealHash: Hex;
  amount: bigint;
}) {
  const [account] = await input.walletClient.getAddresses();
  return input.walletClient.writeContract({
    account,
    chain: input.walletClient.chain,
    address: input.escrowAddress,
    abi: MINI_MARKET_ESCROW_ABI,
    functionName: "createTokenEscrow",
    args: [input.seller, input.arbiter, input.tokenAddress, input.amount, input.dealHash],
  });
}

export async function releaseEscrow(input: {
  walletClient: WalletClient;
  escrowAddress: Address;
  escrowId: bigint;
}) {
  const [account] = await input.walletClient.getAddresses();
  return input.walletClient.writeContract({
    account,
    chain: input.walletClient.chain,
    address: input.escrowAddress,
    abi: MINI_MARKET_ESCROW_ABI,
    functionName: "release",
    args: [input.escrowId],
  });
}

export async function refundEscrow(input: {
  walletClient: WalletClient;
  escrowAddress: Address;
  escrowId: bigint;
}) {
  const [account] = await input.walletClient.getAddresses();
  return input.walletClient.writeContract({
    account,
    chain: input.walletClient.chain,
    address: input.escrowAddress,
    abi: MINI_MARKET_ESCROW_ABI,
    functionName: "refund",
    args: [input.escrowId],
  });
}

export async function openEscrowDispute(input: {
  walletClient: WalletClient;
  escrowAddress: Address;
  escrowId: bigint;
}) {
  const [account] = await input.walletClient.getAddresses();
  return input.walletClient.writeContract({
    account,
    chain: input.walletClient.chain,
    address: input.escrowAddress,
    abi: MINI_MARKET_ESCROW_ABI,
    functionName: "openDispute",
    args: [input.escrowId],
  });
}

export async function resolveEscrowDispute(input: {
  walletClient: WalletClient;
  escrowAddress: Address;
  escrowId: bigint;
  releaseToSeller: boolean;
}) {
  const [account] = await input.walletClient.getAddresses();
  return input.walletClient.writeContract({
    account,
    chain: input.walletClient.chain,
    address: input.escrowAddress,
    abi: MINI_MARKET_ESCROW_ABI,
    functionName: "resolveDispute",
    args: [input.escrowId, input.releaseToSeller],
  });
}

const STATUS_LABELS: Record<number, EscrowStatus> = {
  0: "None",
  1: "Funded",
  2: "Released",
  3: "Refunded",
  4: "Disputed",
  5: "ResolvedToSeller",
  6: "ResolvedToBuyer",
};

export function statusLabel(status: number): EscrowStatus {
  return STATUS_LABELS[status] ?? "None";
}
