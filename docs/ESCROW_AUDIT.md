# Escrow Audit

Use escrow records and events to review deal state.

| Field | Audit use |
| --- | --- |
| `buyer` | Wallet that funded the escrow. |
| `seller` | Wallet that receives a release. |
| `arbiter` | Wallet that can resolve disputes. |
| `token` | Funding asset, with `address(0)` representing native CELO. |
| `amount` | Gross locked amount. |
| `dealHash` | Hash of the visible deal details. |
| `status` | Current escrow lifecycle state. |
