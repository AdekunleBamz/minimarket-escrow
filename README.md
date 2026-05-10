# MiniMarket Escrow

MiniMarket Escrow is a colorful MiniPay + web escrow app for Celo. Buyers can lock value in CELO or stablecoins, settle deals with release/refund/dispute actions, and monitor live onchain TVL and total volume.

## Local Development

```bash
npm install
npm run dev
```

Keep local values in `.env.local`. The committed `.env.example` documents the public settings needed by the browser app.

## Environment

Copy `.env.example` to `.env.local` and add the deployed escrow contract address after Remix deployment.

```bash
NEXT_PUBLIC_ESCROW_CONTRACT_ADDRESS=0x4b82B2b2c98674E29AF17d1bceB80C5142FA498c
NEXT_PUBLIC_CELO_CHAIN_ID=42220
NEXT_PUBLIC_ESCROW_STABLE_TOKEN=0x765DE816845861e75A25fCA122bb6898B8B1282a
NEXT_PUBLIC_ESCROW_STABLE_SYMBOL=USDm
NEXT_PUBLIC_ESCROW_STABLE_DECIMALS=18
```

Mainnet escrow contract is also committed in code:

- `src/lib/market.ts` -> `MINIMARKET_ESCROW_MAINNET_CONTRACT.address`

## Contract

See [docs/REMIX_DEPLOYMENT.md](docs/REMIX_DEPLOYMENT.md).

## MiniPay

MiniMarket Escrow auto-connects inside MiniPay, checks stable balances, and can default to a stable rail in MiniPay sessions. See [docs/MINIPAY_COMPATIBILITY.md](docs/MINIPAY_COMPATIBILITY.md).

## Release Checks

Before deploying to Vercel, run:

```bash
npm run lint
npm run build
```

After deployment, create a small read-only review pass in a normal browser and in MiniPay. Confirm TVL, total volume, and the selected funding token match the intended Celo mainnet contract.
