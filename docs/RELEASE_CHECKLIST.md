# Release Checklist

- Run `npm run lint`.
- Run `npm run typecheck`.
- Run `npm run build`.
- Confirm `NEXT_PUBLIC_ESCROW_CONTRACT_ADDRESS` matches the intended mainnet contract.
- Confirm `MINIMARKET_ESCROW_MAINNET_CONTRACT.address` matches the same deployment.
- Open the dashboard in a normal browser wallet.
- Open the dashboard inside MiniPay.
- Confirm TVL and total volume load without decode errors.
- Confirm the selected funding token matches the wallet mode.
- Confirm a read-only contract call works on the production RPC path.
- Attach one order id and explorer link to the release notes.
