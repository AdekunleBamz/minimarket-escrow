"use client";

import Image from "next/image";
import {
  ArrowRightLeft,
  BadgeCheck,
  Boxes,
  CircleDollarSign,
  ExternalLink,
  Gavel,
  Landmark,
  LoaderCircle,
  ShieldCheck,
  Sparkles,
  Wallet,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  createPublicClient,
  createWalletClient,
  custom,
  erc20Abi,
  formatUnits,
  http,
  isAddress,
  parseUnits,
  zeroAddress,
  type Address,
  type Hex,
} from "viem";
import { celo, celoSepolia } from "viem/chains";
import {
  MINI_CHAIN,
  MINI_MARKET_ESCROW_ABI,
  MINI_STABLECOINS,
  approveEscrowToken,
  assertAddress,
  createDealHash,
  createNativeEscrow,
  createTokenEscrow,
  openEscrowDispute,
  parseEscrowAmount,
  refundEscrow,
  releaseEscrow,
  resolveEscrowDispute,
  statusLabel,
  type EscrowTokenSymbol,
} from "@/lib/minimarket-sdk";
import { MINI_DEFAULT_STABLE_TOKEN, MINIMARKET_ESCROW_MAINNET_CONTRACT } from "@/lib/market";

type EthereumProvider = {
  isMiniPay?: boolean;
  request: (args: { method: string; params?: unknown[] }) => Promise<unknown>;
};

type WalletMode = "unknown" | "browser" | "minipay";
type StableSymbol = keyof typeof MINI_STABLECOINS;
type StableBalance = { symbol: StableSymbol; balance: bigint; display: string; canPay: boolean };

type EscrowDetails = {
  escrowId: bigint;
  buyer: Address;
  seller: Address;
  arbiter: Address;
  token: Address;
  amount: bigint;
  dealHash: Hex;
  createdAt: bigint;
  status: number;
};

type MarketSnapshot = {
  escrowCount: bigint;
  closedCount: bigint;
  nativeTvl: bigint;
  nativeVolume: bigint;
  tokenTvl: bigint;
  tokenVolume: bigint;
};

const configuredChainId = Number(process.env.NEXT_PUBLIC_CELO_CHAIN_ID ?? "42220");
const selectedChain = configuredChainId === MINI_CHAIN.sepolia.id ? celoSepolia : celo;
const chainMeta = configuredChainId === MINI_CHAIN.sepolia.id ? MINI_CHAIN.sepolia : MINI_CHAIN.mainnet;
const escrowContractAddress =
  process.env.NEXT_PUBLIC_ESCROW_CONTRACT_ADDRESS || MINIMARKET_ESCROW_MAINNET_CONTRACT.address;

const stableToken = process.env.NEXT_PUBLIC_ESCROW_STABLE_TOKEN || MINI_DEFAULT_STABLE_TOKEN.address;
const stableSymbol = process.env.NEXT_PUBLIC_ESCROW_STABLE_SYMBOL || MINI_DEFAULT_STABLE_TOKEN.symbol;
const stableDecimals = Number(process.env.NEXT_PUBLIC_ESCROW_STABLE_DECIMALS || MINI_DEFAULT_STABLE_TOKEN.decimals);

const STABLE_SYMBOLS = ["USDm", "USDC", "USDT"] as const satisfies readonly StableSymbol[];
const STABLES: Record<StableSymbol, { symbol: StableSymbol; address: Address; decimals: number; label: string }> = {
  USDm: {
    symbol: "USDm",
    address: stableToken as Address,
    decimals: stableDecimals,
    label: stableSymbol,
  },
  USDC: {
    ...MINI_STABLECOINS.USDC,
    label: MINI_STABLECOINS.USDC.symbol,
  },
  USDT: {
    ...MINI_STABLECOINS.USDT,
    label: MINI_STABLECOINS.USDT.symbol,
  },
};

const STATUS_TEXT: Record<string, string> = {
  None: "Missing",
  Funded: "Funded",
  Released: "Released to seller",
  Refunded: "Refunded to buyer",
  Disputed: "Disputed",
  ResolvedToSeller: "Resolved: seller",
  ResolvedToBuyer: "Resolved: buyer",
};

const QUICK_DEALS = [
  { label: "Phone resale", amount: "18.50", note: "Used device purchase" },
  { label: "Digital design", amount: "7.20", note: "Homepage wireframe milestone" },
  { label: "Wholesale box", amount: "42.00", note: "Bulk groceries delivery" },
];

export default function Home() {
  const [account, setAccount] = useState<Address | null>(null);
  const [walletMode, setWalletMode] = useState<WalletMode>("unknown");
  const [seller, setSeller] = useState("");
  const [arbiter, setArbiter] = useState("");
  const [amount, setAmount] = useState("5.00");
  const [asset, setAsset] = useState<EscrowTokenSymbol>("USDm");
  const [dealLabel, setDealLabel] = useState("Design milestone payment");
  const [escrowIdInput, setEscrowIdInput] = useState("");
  const [resolveToSeller, setResolveToSeller] = useState(true);
  const [metricStableSymbol, setMetricStableSymbol] = useState<StableSymbol>("USDm");
  const [snapshot, setSnapshot] = useState<MarketSnapshot | null>(null);
  const [details, setDetails] = useState<EscrowDetails | null>(null);
  const [stableBalances, setStableBalances] = useState<StableBalance[]>([]);
  const [status, setStatus] = useState("Ready");
  const [error, setError] = useState("");
  const [txHash, setTxHash] = useState<Hex | null>(null);
  const [isBusy, setIsBusy] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const autoConnectStartedRef = useRef(false);

  const shortAccount = useMemo(() => {
    if (!account) return "Connect Wallet";
    return `${account.slice(0, 6)}...${account.slice(-4)}`;
  }, [account]);

  const contractReady = escrowContractAddress.length > 0;
  const explorerTx = txHash ? `${chainMeta.explorerUrl}/tx/${txHash}` : "";
  const isMiniPaySession = walletMode === "minipay";
  const assetOptions = isMiniPaySession ? STABLE_SYMBOLS : [...STABLE_SYMBOLS, "CELO" as const];

  const refreshStableBalances = useCallback(
    async (owner: Address) => {
      const publicClient = createPublicClient({
        chain: selectedChain,
        transport: http(chainMeta.rpcUrl),
      });

      const balances = await Promise.all(
        STABLE_SYMBOLS.map(async (symbol) => {
          const token = STABLES[symbol];
          const required = parseAmountSafe(amount, token.decimals);
          const balance = await publicClient.readContract({
            address: token.address,
            abi: erc20Abi,
            functionName: "balanceOf",
            args: [owner],
          });

          return {
            symbol,
            balance,
            display: trimAmount(formatUnits(balance, token.decimals)),
            canPay: required ? balance >= required : balance > BigInt(0),
          } satisfies StableBalance;
        }),
      );

      setStableBalances(balances);
      const preferred = choosePreferredStable(balances, asset);
      if (preferred && preferred !== asset) {
        setAsset(preferred);
      }
    },
    [amount, asset],
  );

  const refreshSnapshot = useCallback(async () => {
    if (!contractReady) {
      setSnapshot(null);
      return;
    }

    setIsRefreshing(true);
    try {
      const publicClient = createPublicClient({
        chain: selectedChain,
        transport: http(chainMeta.rpcUrl),
      });
      const metricToken = STABLES[metricStableSymbol].address;
      const raw = (await publicClient.readContract({
        address: assertAddress(escrowContractAddress, "escrow contract"),
        abi: MINI_MARKET_ESCROW_ABI,
        functionName: "marketSnapshot",
        args: [metricToken],
      })) as readonly [bigint, bigint, bigint, bigint, bigint, bigint];

      setSnapshot({
        escrowCount: raw[0],
        closedCount: raw[1],
        nativeTvl: raw[2],
        nativeVolume: raw[3],
        tokenTvl: raw[4],
        tokenVolume: raw[5],
      });
    } catch (snapshotError) {
      setError(readError(snapshotError, "Failed to load TVL and volume metrics."));
    } finally {
      setIsRefreshing(false);
    }
  }, [contractReady, metricStableSymbol]);

  const loadEscrowDetails = useCallback(
    async (escrowId: bigint) => {
      if (!contractReady) return;

      try {
        const publicClient = createPublicClient({
          chain: selectedChain,
          transport: http(chainMeta.rpcUrl),
        });
        const raw = (await publicClient.readContract({
          address: assertAddress(escrowContractAddress, "escrow contract"),
          abi: MINI_MARKET_ESCROW_ABI,
          functionName: "escrows",
          args: [escrowId],
        })) as readonly [Address, Address, Address, Address, bigint, Hex, bigint, number];

        if (raw[0].toLowerCase() === zeroAddress) {
          setDetails(null);
          return;
        }

        setDetails({
          escrowId,
          buyer: raw[0],
          seller: raw[1],
          arbiter: raw[2],
          token: raw[3],
          amount: raw[4],
          dealHash: raw[5],
          createdAt: raw[6],
          status: Number(raw[7]),
        });
      } catch (detailsError) {
        setError(readError(detailsError, "Unable to load escrow details."));
      }
    },
    [contractReady],
  );

  useEffect(() => {
    let cancelled = false;
    let attempts = 0;
    let timer: number | undefined;

    function detectWalletProvider() {
      const provider = getOptionalProvider();
      if (!provider) {
        if (attempts < 12) {
          attempts += 1;
          timer = window.setTimeout(detectWalletProvider, 200);
        }
        return;
      }

      const detectedProvider = provider;
      const miniPayDetected = isMiniPay(detectedProvider);
      queueMicrotask(() => {
        if (!cancelled) {
          setWalletMode(miniPayDetected ? "minipay" : "browser");
        }
      });

      if (!miniPayDetected || autoConnectStartedRef.current) return;
      autoConnectStartedRef.current = true;

      async function autoConnectMiniPay() {
        setStatus("Connecting MiniPay");
        try {
          const accounts = (await detectedProvider.request({ method: "eth_requestAccounts" })) as Address[];
          const connected = assertAddress(accounts[0], "wallet");
          if (cancelled) return;
          setAccount(connected);
          setSeller((current) => current || connected);
          setArbiter((current) => current || connected);
          await refreshStableBalances(connected);
          setStatus("MiniPay connected");
        } catch (connectError) {
          if (cancelled) return;
          setError(readError(connectError, "MiniPay connection failed."));
          setStatus("Open MiniPay wallet");
        }
      }

      void autoConnectMiniPay();
    }

    detectWalletProvider();
    const bootRefresh = window.setTimeout(() => {
      void refreshSnapshot();
    }, 0);

    return () => {
      cancelled = true;
      if (timer) window.clearTimeout(timer);
      window.clearTimeout(bootRefresh);
    };
  }, [refreshSnapshot, refreshStableBalances]);

  useEffect(() => {
    if (!account || walletMode !== "minipay") return;
    const timer = window.setTimeout(() => {
      void refreshStableBalances(account);
    }, 350);
    return () => window.clearTimeout(timer);
  }, [account, amount, refreshStableBalances, walletMode]);

  useEffect(() => {
    const refreshHandle = window.setTimeout(() => {
      void refreshSnapshot();
    }, 0);

    return () => window.clearTimeout(refreshHandle);
  }, [metricStableSymbol, refreshSnapshot]);

  async function connectWallet() {
    setError("");
    setStatus("Opening wallet");

    try {
      const provider = getProvider();
      const accounts = (await provider.request({ method: "eth_requestAccounts" })) as Address[];
      await ensureCeloNetwork(provider);

      const connected = assertAddress(accounts[0], "wallet");
      const miniPaySession = isMiniPay(provider);
      setWalletMode(miniPaySession ? "minipay" : "browser");
      setAccount(connected);
      setSeller((current) => current || connected);
      setArbiter((current) => current || connected);

      if (miniPaySession) {
        await refreshStableBalances(connected);
      }
      setStatus("Wallet connected");
    } catch (connectError) {
      setError(readError(connectError, "Wallet connection failed."));
      setStatus("Ready");
    }
  }

  async function createEscrowFlow() {
    setError("");
    setTxHash(null);

    if (!contractReady) {
      setError("Add NEXT_PUBLIC_ESCROW_CONTRACT_ADDRESS to connect this app to your deployed escrow contract.");
      return;
    }

    try {
      const provider = getProvider();
      const accounts = (await provider.request({ method: "eth_requestAccounts" })) as Address[];
      await ensureCeloNetwork(provider);

      const connected = assertAddress(accounts[0], "wallet");
      const chosenSeller = assertAddress(seller, "seller");
      const chosenArbiter = arbiter ? assertAddress(arbiter, "arbiter") : connected;
      const contractAddress = assertAddress(escrowContractAddress, "escrow contract");
      const dealHash = createDealHash({
        buyer: connected,
        seller: chosenSeller,
        label: dealLabel,
        amount,
        symbol: asset,
      });

      setIsBusy(true);
      const walletClient = createWalletClient({
        chain: selectedChain,
        transport: custom(provider),
      });
      const publicClient = createPublicClient({
        chain: selectedChain,
        transport: http(chainMeta.rpcUrl),
      });

      let hash: Hex;
      if (asset === "CELO") {
        setStatus("Confirm native escrow transaction");
        hash = await createNativeEscrow({
          walletClient,
          escrowAddress: contractAddress,
          seller: chosenSeller,
          arbiter: chosenArbiter,
          dealHash,
          amount: parseEscrowAmount(amount, "CELO"),
        });
      } else {
        const stable = STABLES[asset];
        const tokenAmount = parseEscrowAmount(amount, asset);
        setStatus(`Approve ${stable.label}`);
        const approveHash = await approveEscrowToken({
          walletClient,
          tokenAddress: stable.address,
          escrowAddress: contractAddress,
          amount: tokenAmount,
        });
        await publicClient.waitForTransactionReceipt({ hash: approveHash });

        setStatus(`Confirm ${stable.label} escrow`);
        hash = await createTokenEscrow({
          walletClient,
          escrowAddress: contractAddress,
          seller: chosenSeller,
          arbiter: chosenArbiter,
          tokenAddress: stable.address,
          dealHash,
          amount: tokenAmount,
        });
      }

      setTxHash(hash);
      setStatus("Waiting for confirmation");
      const receipt = await publicClient.waitForTransactionReceipt({ hash });
      setStatus("Escrow created");
      await refreshSnapshot();

      if (account && isMiniPaySession) {
        await refreshStableBalances(account);
      }

      if (receipt.status === "success") {
        const currentId = await publicClient.readContract({
          address: contractAddress,
          abi: MINI_MARKET_ESCROW_ABI,
          functionName: "totalEscrows",
        });
        setEscrowIdInput(currentId.toString());
        await loadEscrowDetails(currentId);
      }
    } catch (createError) {
      setError(readError(createError, "Unable to create escrow."));
      setStatus("Ready");
    } finally {
      setIsBusy(false);
    }
  }

  async function runEscrowAction(
    action: "release" | "refund" | "dispute" | "resolve",
    options: { resolveToSeller?: boolean } = {},
  ) {
    setError("");
    setTxHash(null);

    if (!contractReady) {
      setError("Set NEXT_PUBLIC_ESCROW_CONTRACT_ADDRESS first.");
      return;
    }

    try {
      const escrowId = BigInt(escrowIdInput.trim());
      const provider = getProvider();
      const accounts = (await provider.request({ method: "eth_requestAccounts" })) as Address[];
      await ensureCeloNetwork(provider);
      assertAddress(accounts[0], "wallet");

      setIsBusy(true);
      const walletClient = createWalletClient({
        chain: selectedChain,
        transport: custom(provider),
      });
      const publicClient = createPublicClient({
        chain: selectedChain,
        transport: http(chainMeta.rpcUrl),
      });
      const contractAddress = assertAddress(escrowContractAddress, "escrow contract");

      let hash: Hex;
      if (action === "release") {
        setStatus("Confirm release");
        hash = await releaseEscrow({ walletClient, escrowAddress: contractAddress, escrowId });
      } else if (action === "refund") {
        setStatus("Confirm refund");
        hash = await refundEscrow({ walletClient, escrowAddress: contractAddress, escrowId });
      } else if (action === "dispute") {
        setStatus("Confirm dispute");
        hash = await openEscrowDispute({ walletClient, escrowAddress: contractAddress, escrowId });
      } else {
        setStatus("Confirm dispute resolution");
        hash = await resolveEscrowDispute({
          walletClient,
          escrowAddress: contractAddress,
          escrowId,
          releaseToSeller: options.resolveToSeller ?? true,
        });
      }

      setTxHash(hash);
      setStatus("Waiting for confirmation");
      await publicClient.waitForTransactionReceipt({ hash });
      setStatus("Escrow action completed");
      await refreshSnapshot();
      await loadEscrowDetails(escrowId);
    } catch (actionError) {
      setError(readError(actionError, "Escrow action failed."));
      setStatus("Ready");
    } finally {
      setIsBusy(false);
    }
  }

  const metricStable = STABLES[metricStableSymbol];

  return (
    <main className="min-h-screen px-4 py-5 text-[var(--ink)] sm:px-6 lg:px-8">
      <div className="mx-auto w-full max-w-7xl">
        <header className="glass flex flex-wrap items-center justify-between gap-3 px-4 py-4 sm:px-6">
          <div className="flex min-w-0 items-center gap-3">
            <Image src="/minimarket-logo.svg" alt="MiniMarket Escrow" width={50} height={50} className="shrink-0 rounded-2xl" />
            <div className="min-w-0">
              <p className="text-[0.7rem] font-bold uppercase tracking-[0.16em] text-[var(--muted)]">Project 3</p>
              <h1 className="truncate text-2xl font-black [font-family:var(--font-title)] sm:text-3xl">MiniMarket Escrow</h1>
              <p className="truncate text-sm text-[var(--muted)]">Escrow rails with real-time TVL and total volume on Celo.</p>
            </div>
          </div>
          <div className="flex flex-wrap items-center justify-end gap-2">
            <span className="pill">
              <Sparkles size={14} />
              {chainMeta.name}
            </span>
            <span className="pill">
              <BadgeCheck size={14} />
              {contractReady ? "Contract linked" : "Set escrow contract"}
            </span>
            <button
              type="button"
              onClick={connectWallet}
              className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-white/80 bg-white/88 px-4 text-sm font-bold text-[#1a0c39] transition hover:bg-white"
              title={shortAccount}
            >
              <Wallet size={17} />
              <span className="truncate">{shortAccount}</span>
            </button>
          </div>
        </header>

        <section className="mt-4 grid gap-4 xl:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)]">
          <article className="glass p-4 sm:p-5">
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-xl font-black [font-family:var(--font-title)]">Create Escrow</h2>
              <span className="pill">
                <ShieldCheck size={14} />
                Buyer-protected
              </span>
            </div>

            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <Field label="Seller wallet">
                <input
                  value={seller}
                  onChange={(event) => setSeller(event.target.value)}
                  placeholder="0x..."
                  className="field"
                />
              </Field>
              <Field label="Arbiter wallet">
                <input
                  value={arbiter}
                  onChange={(event) => setArbiter(event.target.value)}
                  placeholder="Optional (defaults to connected wallet)"
                  className="field"
                />
              </Field>
              <Field label="Amount">
                <input value={amount} onChange={(event) => setAmount(event.target.value)} inputMode="decimal" className="field" />
              </Field>
              <Field label="Asset">
                <select value={asset} onChange={(event) => setAsset(event.target.value as EscrowTokenSymbol)} className="field">
                  {assetOptions.map((symbol) => (
                    <option key={symbol} value={symbol}>
                      {symbol === "USDm" ? STABLES.USDm.label : symbol}
                    </option>
                  ))}
                </select>
              </Field>
            </div>

            <Field label="Deal label">
              <textarea
                value={dealLabel}
                onChange={(event) => setDealLabel(event.target.value)}
                className="field min-h-24 resize-none leading-6"
                maxLength={180}
              />
            </Field>

            <div className="mt-3 grid gap-2 sm:grid-cols-3">
              {QUICK_DEALS.map((item) => (
                <button
                  key={item.label}
                  type="button"
                  onClick={() => {
                    setDealLabel(item.note);
                    setAmount(item.amount);
                  }}
                  className="rounded-xl border border-white/30 bg-white/10 px-3 py-2 text-left transition hover:bg-white/20"
                >
                  <p className="truncate text-sm font-black">{item.label}</p>
                  <p className="mt-1 text-xs text-[var(--muted)]">{item.amount} • {item.note}</p>
                </button>
              ))}
            </div>

            {isMiniPaySession && account ? (
              <div className="mt-3 flex flex-wrap gap-2">
                {stableBalances.map((item) => (
                  <span
                    key={item.symbol}
                    className={`pill ${
                      item.symbol === asset
                        ? "border-emerald-100/90 bg-emerald-200/80 text-emerald-950"
                        : "border-white/60 bg-white/35 text-[#1a0c39]"
                    }`}
                  >
                    {item.symbol}: {item.display}
                  </span>
                ))}
              </div>
            ) : null}

            <button
              type="button"
              onClick={() => void createEscrowFlow()}
              disabled={isBusy}
              className="mt-4 inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-cyan-300 via-fuchsia-300 to-amber-300 px-4 text-[0.95rem] font-black text-[#180a33] shadow-xl shadow-fuchsia-950/40 transition hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isBusy ? <LoaderCircle className="animate-spin" size={18} /> : <ArrowRightLeft size={18} />}
              Create Escrow
            </button>
          </article>

          <article className="glass p-4 sm:p-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 className="text-xl font-black [font-family:var(--font-title)]">Live Market Metrics</h2>
              <select
                value={metricStableSymbol}
                onChange={(event) => setMetricStableSymbol(event.target.value as StableSymbol)}
                className="field max-w-[12rem]"
              >
                {STABLE_SYMBOLS.map((symbol) => (
                  <option key={symbol} value={symbol}>
                    {symbol === "USDm" ? STABLES.USDm.label : symbol}
                  </option>
                ))}
              </select>
            </div>

            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <MetricCard
                icon={<Landmark size={18} />}
                label="TVL (CELO)"
                value={snapshot ? `${trimAmount(formatUnits(snapshot.nativeTvl, 18))} CELO` : "-"}
              />
              <MetricCard
                icon={<CircleDollarSign size={18} />}
                label={`TVL (${metricStable.label})`}
                value={snapshot ? `${trimAmount(formatUnits(snapshot.tokenTvl, metricStable.decimals))} ${metricStable.label}` : "-"}
              />
              <MetricCard
                icon={<Boxes size={18} />}
                label="Total Volume (CELO)"
                value={snapshot ? `${trimAmount(formatUnits(snapshot.nativeVolume, 18))} CELO` : "-"}
              />
              <MetricCard
                icon={<Sparkles size={18} />}
                label={`Total Volume (${metricStable.label})`}
                value={snapshot ? `${trimAmount(formatUnits(snapshot.tokenVolume, metricStable.decimals))} ${metricStable.label}` : "-"}
              />
            </div>

            <div className="mt-3 flex flex-wrap gap-2 text-xs font-semibold text-[var(--muted)]">
              <span className="pill">Escrows: {snapshot ? snapshot.escrowCount.toString() : "-"}</span>
              <span className="pill">Closed: {snapshot ? snapshot.closedCount.toString() : "-"}</span>
              <span className="pill">{isRefreshing ? "Refreshing..." : "Synced"}</span>
            </div>
          </article>
        </section>

        <section className="mt-4 grid gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
          <article className="glass p-4 sm:p-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 className="text-xl font-black [font-family:var(--font-title)]">Lifecycle Control</h2>
              <span className="pill">
                <Gavel size={14} />
                Operator actions
              </span>
            </div>

            <div className="mt-4 grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto]">
              <input
                value={escrowIdInput}
                onChange={(event) => setEscrowIdInput(event.target.value)}
                placeholder="Escrow ID"
                inputMode="numeric"
                className="field"
              />
              <button
                type="button"
                onClick={() => {
                  try {
                    const id = BigInt(escrowIdInput.trim());
                    void loadEscrowDetails(id);
                  } catch {
                    setError("Escrow ID must be a whole number.");
                  }
                }}
                className="rounded-xl border border-white/40 bg-white/15 px-4 text-sm font-bold transition hover:bg-white/25"
              >
                Load
              </button>
            </div>

            <div className="mt-3 grid gap-2 sm:grid-cols-2">
              <button
                type="button"
                onClick={() => void runEscrowAction("release")}
                disabled={isBusy || !escrowIdInput.trim()}
                className="rounded-xl border border-emerald-100/90 bg-emerald-200/85 px-3 py-2 text-sm font-black text-emerald-950 transition hover:bg-emerald-200 disabled:cursor-not-allowed disabled:opacity-60"
              >
                Release to seller
              </button>
              <button
                type="button"
                onClick={() => void runEscrowAction("refund")}
                disabled={isBusy || !escrowIdInput.trim()}
                className="rounded-xl border border-sky-100/90 bg-sky-200/85 px-3 py-2 text-sm font-black text-sky-950 transition hover:bg-sky-200 disabled:cursor-not-allowed disabled:opacity-60"
              >
                Refund to buyer
              </button>
              <button
                type="button"
                onClick={() => void runEscrowAction("dispute")}
                disabled={isBusy || !escrowIdInput.trim()}
                className="rounded-xl border border-amber-100/90 bg-amber-200/90 px-3 py-2 text-sm font-black text-amber-950 transition hover:bg-amber-200 disabled:cursor-not-allowed disabled:opacity-60"
              >
                Open dispute
              </button>
              <button
                type="button"
                onClick={() => void runEscrowAction("resolve", { resolveToSeller })}
                disabled={isBusy || !escrowIdInput.trim()}
                className="rounded-xl border border-fuchsia-100/90 bg-fuchsia-200/85 px-3 py-2 text-sm font-black text-fuchsia-950 transition hover:bg-fuchsia-200 disabled:cursor-not-allowed disabled:opacity-60"
              >
                Resolve dispute
              </button>
            </div>

            <label className="mt-3 inline-flex items-center gap-2 text-sm font-semibold text-[var(--muted)]">
              <input
                type="checkbox"
                checked={resolveToSeller}
                onChange={(event) => setResolveToSeller(event.target.checked)}
                className="h-4 w-4 accent-emerald-300"
              />
              Resolve payout to seller (uncheck for buyer)
            </label>
          </article>

          <article className="glass p-4 sm:p-5">
            <h2 className="text-xl font-black [font-family:var(--font-title)]">Escrow Detail</h2>
            {details ? (
              <div className="mt-3 grid gap-2 text-sm">
                <Row label="Escrow ID" value={details.escrowId.toString()} />
                <Row label="Status" value={STATUS_TEXT[statusLabel(details.status)]} />
                <Row label="Buyer" value={shortAddress(details.buyer)} />
                <Row label="Seller" value={shortAddress(details.seller)} />
                <Row label="Arbiter" value={shortAddress(details.arbiter)} />
                <Row
                  label="Asset"
                  value={
                    details.token.toLowerCase() === zeroAddress
                      ? `${trimAmount(formatUnits(details.amount, 18))} CELO`
                      : `${trimAmount(formatUnits(details.amount, tokenDecimalsForAddress(details.token)))} ${symbolForAddress(details.token)}`
                  }
                />
                <Row label="Deal hash" value={`${details.dealHash.slice(0, 12)}...${details.dealHash.slice(-8)}`} />
              </div>
            ) : (
              <p className="mt-3 text-sm text-[var(--muted)]">
                Load an escrow ID to inspect party addresses, status, and locked value.
              </p>
            )}

            <div className="mt-4 rounded-xl border border-white/30 bg-white/10 px-3 py-3">
              <p className="text-sm font-semibold text-[var(--ink)]">{status}</p>
              {error ? (
                <p className="mt-2 rounded-lg border border-[var(--danger)]/40 bg-[var(--danger)]/20 px-3 py-2 text-sm font-semibold text-rose-100">
                  {error}
                </p>
              ) : null}
              {explorerTx ? (
                <a
                  href={explorerTx}
                  target="_blank"
                  rel="noreferrer"
                  className="mt-2 inline-flex items-center gap-2 text-sm font-bold text-cyan-100 underline underline-offset-2"
                >
                  View transaction
                  <ExternalLink size={14} />
                </a>
              ) : null}
            </div>
          </article>
        </section>
      </div>
    </main>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-xs font-bold uppercase tracking-[0.1em] text-[var(--muted)]">{label}</span>
      {children}
    </label>
  );
}

function MetricCard({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="metric-card p-3">
      <div className="flex items-center gap-2 text-[var(--ink)]">
        {icon}
        <p className="text-xs font-bold uppercase tracking-[0.08em]">{label}</p>
      </div>
      <p className="mt-2 truncate text-lg font-black [font-family:var(--font-title)]">{value}</p>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="grid grid-cols-[5rem_minmax(0,1fr)] items-center gap-2 rounded-lg border border-white/25 bg-white/8 px-3 py-2">
      <span className="text-[10px] font-bold uppercase tracking-[0.08em] text-[var(--muted)]">{label}</span>
      <span className="min-w-0 truncate text-right font-semibold text-[var(--ink)]">{value}</span>
    </div>
  );
}

function symbolForAddress(tokenAddress: Address) {
  const lower = tokenAddress.toLowerCase();
  if (lower === STABLES.USDm.address.toLowerCase()) return STABLES.USDm.label;
  if (lower === STABLES.USDC.address.toLowerCase()) return STABLES.USDC.label;
  if (lower === STABLES.USDT.address.toLowerCase()) return STABLES.USDT.label;
  return "TOKEN";
}

function tokenDecimalsForAddress(tokenAddress: Address) {
  const lower = tokenAddress.toLowerCase();
  if (lower === STABLES.USDm.address.toLowerCase()) return STABLES.USDm.decimals;
  if (lower === STABLES.USDC.address.toLowerCase()) return STABLES.USDC.decimals;
  if (lower === STABLES.USDT.address.toLowerCase()) return STABLES.USDT.decimals;
  return 18;
}

function shortAddress(address: Address) {
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

function parseAmountSafe(rawAmount: string, decimals: number) {
  try {
    return parseUnits(rawAmount.trim(), decimals);
  } catch {
    return null;
  }
}

function choosePreferredStable(balances: StableBalance[], current: EscrowTokenSymbol) {
  if (current !== "CELO") {
    const match = balances.find((item) => item.symbol === current);
    if (match?.canPay) return match.symbol;
  }

  return balances.find((item) => item.canPay)?.symbol ?? null;
}

function trimAmount(value: string) {
  const [whole, fraction = ""] = value.split(".");
  const trimmed = fraction.slice(0, 4).replace(/0+$/, "");
  return trimmed ? `${whole}.${trimmed}` : whole;
}

function getProvider(): EthereumProvider {
  const provider = getOptionalProvider();
  if (!provider) {
    throw new Error("Open this app in MiniPay or a Celo-compatible wallet browser.");
  }
  return provider;
}

function getOptionalProvider(): EthereumProvider | null {
  if (typeof window === "undefined") return null;
  return (window as typeof window & { ethereum?: EthereumProvider }).ethereum ?? null;
}

function isMiniPay(provider: EthereumProvider): boolean {
  return Boolean(provider.isMiniPay || /MiniPay/i.test(window.navigator.userAgent));
}

async function ensureCeloNetwork(provider: EthereumProvider) {
  if (isMiniPay(provider)) {
    return;
  }

  const chainId = `0x${configuredChainId.toString(16)}`;
  try {
    await provider.request({
      method: "wallet_switchEthereumChain",
      params: [{ chainId }],
    });
  } catch (switchError) {
    const maybeError = switchError as { code?: number };
    if (maybeError.code !== 4902) {
      throw switchError;
    }
    await provider.request({
      method: "wallet_addEthereumChain",
      params: [
        {
          chainId,
          chainName: chainMeta.name,
          nativeCurrency: { name: "CELO", symbol: "CELO", decimals: 18 },
          rpcUrls: [chainMeta.rpcUrl],
          blockExplorerUrls: [chainMeta.explorerUrl],
        },
      ],
    });
  }
}

function readError(error: unknown, fallback: string) {
  let message = fallback;
  if (error instanceof Error && error.message) {
    message = error.message;
  } else if (typeof error === "object" && error && "message" in error) {
    message = String((error as { message?: unknown }).message) || fallback;
  }

  const compact = message.replace(/\s+/g, " ").trim();
  const lower = compact.toLowerCase();

  if (lower.includes("user rejected") || lower.includes("user denied") || lower.includes("rejected the request")) {
    return "Wallet request was rejected.";
  }
  if (lower.includes("insufficient funds") || lower.includes("not enough gas") || lower.includes("gas balance")) {
    return "Connected wallet does not have enough balance for value and gas.";
  }
  if (!isAddress(escrowContractAddress)) {
    return "Escrow contract address is missing or invalid.";
  }
  return compact.length > 300 ? `${compact.slice(0, 300)}...` : compact;
}
