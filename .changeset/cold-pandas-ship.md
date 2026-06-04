---
"api": minor
"ui": minor
---

Add manual/fulfillment email flow with Resend

- Replace `merch@near.foundation` with `orders@nearmerch.com` as the default sender
- Add `handleOrderPaidEffect` shared helper for post-payment side effects
- Confirm non-manual provider drafts (Printful/Lulu) on payment success
- Send manual notification email on payment success using Resend
- Persist shipping address on order creation
- Fix `ProviderConfigStore.upsertConfig` to save `settings` on first insert
- Fix product-level manual notification recipients surviving checkout into order items
- Route manual provider notifications through `ProviderConfigStore` settings (global emails + owner account IDs + per-product emails)
- Add `Manual only` filter to admin orders page
- Remove `manual_fulfillments` subsystem, admin queue page, and migration `0012_grey_warbird`
- Add `RESEND_API_KEY` and `MANUAL_FULFILLMENT_FROM_EMAIL` env vars
- Add unit test for `handleOrderPaidEffect` (mixed provider + email recipients)
- Add integration test for manual provider config persistence and email flow
- Add `clearProviderConfigs` test helper