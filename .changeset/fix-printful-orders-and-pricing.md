---
"api": minor
---

Fix Printful orders created without designs and draft confirmation failures

- Resolve missing techniques at order time by fetching catalog product from Printful API
- Throw FulfillmentError if no valid placements after resolution (no silent blank orders)
- Default slot to 'default' when undefined on files
- Add shouldRetryConfirmation to Printful webhook for order_updated+draft
- Add retry-confirmation cron job as safety net for stuck orders
- Add findPendingConfirmation to OrderStore
- Fix Printful V2 pricing to correctly parse technique and placement prices
- Add fulfillmentCost to variant providerConfig and API responses
- Add priceLocked flag to products DB schema and admin API
- Handle catalog_price_changed webhook by re-syncing pricing
- Add 0011 migration for price_locked column
