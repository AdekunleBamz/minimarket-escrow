# Security Notes

- Verify the escrow contract address before funding any deal.
- Keep private keys out of repo files, screenshots, and public Vercel variables.
- Confirm buyer, seller, and arbiter addresses before creating escrow.
- Treat deal hashes as audit references, not private data.
- Recheck stablecoin token addresses after every deployment change.
- Confirm arbiter and treasury wallets before each production escrow release.
- Do not include deal amounts or buyer addresses in user-visible error messages.
