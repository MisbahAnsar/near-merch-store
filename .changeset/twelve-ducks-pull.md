---
"ui": minor
"api": minor
---

Add "Claim Merch Box" page — exclusive to Vanguard SBT holders

- New route `/claim/merch-box` under `_authenticated` layout (requires NEAR wallet session)
- Backend `MerchBoxService` validates Vanguard SBT ownership via NEAR RPC (`vanguard.nearlegion.near`)
- Merch box requests stored in database (`merch_box_requests` table) for admin review
- API endpoints: `submitMerchBoxRequest` (POST), `checkVanguardSbt` (POST), `getMerchBoxRequests` (GET /admin), `markMerchBoxRequestReviewed` (POST /admin)
- Claim page features dynamic line-item table (Article | QTY | COST) with auto-calculated total + remove/add row + optional notes field
- Admin dashboard page at `/dashboard/merch-box` with paginated DataTable, item expansion, and "Mark Reviewed" actions
- Floating green "Claim Merch Box" FAB (bottom-right, dismissible via localStorage) mounted globally
- Footer link with gift icon and green accent
- Sidebar nav link in admin layout
