---
"ui": minor
"api": minor
---

Add "Claim Merch Box" page — exclusive to Vanguard SBT holders

- New route `/claim/merch-box` under `_authenticated` layout (requires NEAR wallet session)
- Backend `MerchBoxService` validates Vanguard SBT ownership via NEAR RPC (`vanguard.nearlegion.near`) and sends order request emails to `merch@near.foundation` via Resend
- New API endpoints: `submitMerchBoxRequest` (POST /merch-box/request) and `checkVanguardSbt` (POST /merch-box/check-sbt)
- Dedicated claim page with wallet status, SBT verification, order form for holders, and Legion upsell for non-holders
- Floating "Claim Merch Box" FAB (bottom-right, green, dismissible via localStorage) mounted globally in the marketplace layout
- Footer link updated with gift icon and green accent
