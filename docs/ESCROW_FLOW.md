# Escrow Flow

1. Buyer enters seller, arbiter, label, amount, and funding token.
2. The app derives a deal hash from the visible deal details.
3. Stablecoin escrows approve the escrow contract, then call `createTokenEscrow(...)`.
4. Native CELO escrows call `createNativeEscrow(...)`.
5. Funded escrows can be released, refunded, disputed, or resolved.
6. Market metrics update from contract analytics after settlement.

Stablecoin approvals should match the exact escrow amount in token base units.

USDm uses 18 decimals; USDC and USDT use 6 decimals. Use the configured token decimals when converting the human-readable amount before calling approve.

Record the approval hash beside the escrow funding hash when a stablecoin allowance is required.
