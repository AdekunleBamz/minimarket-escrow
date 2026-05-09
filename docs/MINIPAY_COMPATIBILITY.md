# MiniPay Compatibility

MiniMarket Escrow is designed to work in both MiniPay and standard browser wallets on Celo.

## Stablecoin Defaults

The app supports escrow funding with USDm, USDC, and USDT on Celo Mainnet.

| Token | Address |
| --- | --- |
| USDm | `0x765DE816845861e75A25fCA122bb6898B8B1282a` |
| USDC | `0xcebA9300f2b948710d2653dD7B07f33A8B32118C` |
| USDT | `0x48065fbbe25f71c9282ddf5e1cd6d6a887483d5e` |

These addresses are available through `@bamzzstudio/minimarket-escrow-sdk`.
The `.env.example` includes stable override fields in case your deployment wants a custom stable token configuration.

## MiniPay Flow

- The app detects MiniPay through `window.ethereum.isMiniPay` or the browser user agent.
- The app auto-connects the MiniPay wallet on launch.
- The app checks USDm, USDC, and USDT balances and can auto-prefer a stable rail with sufficient balance.
- MiniPay sessions do not call `wallet_switchEthereumChain`.
- Escrow funding uses `createTokenEscrow(...)` for stablecoin paths.

## Stable Rail Checks

- Confirm the chosen stablecoin address and decimals match the amount shown in the funding form.
- Confirm the buyer approves the stablecoin before the escrow creation transaction is requested.
- Confirm MiniPay sessions stay on Celo mainnet and use `createTokenEscrow(...)` for stable funding.

## Web Wallet Flow

Normal browser wallets can use:

- USDm, USDC, or USDT through `createTokenEscrow(...)`
- Native CELO through `createNativeEscrow(...)`

The dashboard reads live onchain analytics through `marketSnapshot(token)` to display TVL and total volume.
