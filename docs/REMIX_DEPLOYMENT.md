# Remix Deployment

Deploy `contracts/MiniMarketEscrow.sol` manually from Remix.

## Constructor

```solidity
constructor(
  address initialOwner_
)
```

Recommended values:

- `initialOwner_`: your owner wallet.

Use an owner wallet that can safely manage any future contract administration or verification follow-up.

## App Env

After deploying, set:

```bash
NEXT_PUBLIC_ESCROW_CONTRACT_ADDRESS=0x4b82B2b2c98674E29AF17d1bceB80C5142FA498c
NEXT_PUBLIC_CELO_CHAIN_ID=42220
NEXT_PUBLIC_ESCROW_STABLE_TOKEN=0x765DE816845861e75A25fCA122bb6898B8B1282a
NEXT_PUBLIC_ESCROW_STABLE_SYMBOL=USDm
NEXT_PUBLIC_ESCROW_STABLE_DECIMALS=18
```

The app includes Celo Mainnet USDC and USDT constants through the SDK as alternative rails.
The app code also hardcodes your deployed mainnet escrow contract as fallback in `src/lib/market.ts`.

## TVL and Total Volume

This contract exposes analytics directly:

- `tvlNative` and `tvlByToken(token)`: currently locked value.
- `totalVolumeNative` and `totalVolumeByToken(token)`: cumulative settled value.
- `marketSnapshot(token)`: one-call dashboard metrics.

## Verification

Verify the contract on Celoscan with the same constructor value used in Remix.

## Post-Deploy Smoke Check

- Read `owner` from the deployed escrow contract in Remix.
- Call `marketSnapshot` for USDm and confirm the returned values decode without errors.
- Confirm `NEXT_PUBLIC_ESCROW_CONTRACT_ADDRESS` and `MINIMARKET_ESCROW_MAINNET_CONTRACT.address` point to the same mainnet deployment.
