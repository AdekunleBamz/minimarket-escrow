# MiniMarket Escrow Contracts

`MiniMarketEscrow.sol` is an escrow contract for Celo that tracks both live TVL and cumulative total volume.

Core escrow flows:

- `createNativeEscrow`: buyer funds escrow in CELO.
- `createTokenEscrow`: buyer funds escrow in ERC-20 (for example USDm/USDC/USDT).
- `release`: buyer releases funds to seller.
- `refund`: seller/arbiter refunds buyer.
- `openDispute` + `resolveDispute`: dispute lifecycle.

Key analytics:

- `tvlNative` and `tvlByToken(token)`: currently locked value.
- `totalVolumeNative` and `totalVolumeByToken(token)`: cumulative settled value.
- `marketSnapshot(token)`: one-call dashboard metrics for app UI.

Deployment guide: [docs/REMIX_DEPLOYMENT.md](../docs/REMIX_DEPLOYMENT.md)
