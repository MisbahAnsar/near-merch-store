---
"api": patch
---

Fix local integration test database bootstrapping so the checkout flow test can use the repo's local Postgres credentials and create the `api_test` database when needed.
