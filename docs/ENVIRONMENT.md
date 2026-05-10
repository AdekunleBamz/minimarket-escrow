# Environment Reference

MiniMarket Escrow uses public variables to select the Celo chain, escrow contract, and default stablecoin display values.

| Variable | Purpose |
| --- | --- |
| `NEXT_PUBLIC_APP_URL` | Base URL used for generated links when needed outside the browser. |
| `NEXT_PUBLIC_ESCROW_CONTRACT_ADDRESS` | Deployed `MiniMarketEscrow` contract used by the app. |
| `NEXT_PUBLIC_CELO_CHAIN_ID` | Celo chain id. Use `42220` for mainnet. |
| `NEXT_PUBLIC_ESCROW_STABLE_TOKEN` | Default USDm token address. |
| `NEXT_PUBLIC_ESCROW_STABLE_SYMBOL` | Default stablecoin symbol shown in the UI. |
| `NEXT_PUBLIC_ESCROW_STABLE_DECIMALS` | Default stablecoin decimals used for amount conversion. |

## Unit Notes

Native CELO escrow amounts use 18 decimals. Stablecoin amounts are converted with the selected token decimals before approval and escrow creation.

## Vercel Notes

Update the escrow contract address in Vercel before promoting a deployment that points to a new contract. Public variables are baked into the browser bundle at build time.
