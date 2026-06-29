---
"ui": minor
---

Add dedicated Lulu product builder for creating print-on-demand books and publications.

- New `LuluBuilder` component at `ui/src/components/admin/lulu-product-builder.tsx` — self-contained form using `@tanstack/react-form` with field-level validation
- Collects Lulu-specific fields: podPackageId, pageCount, format, cover PDF URL (upload or paste), interior PDF URL (upload or paste)
- Free download toggle auto-populates the download URL from the interior PDF
- Submits correctly-structured `providerConfig` (podPackageId, pageCount, coverPdfUrl, interiorPdfUrl) so Lulu fulfillment orders work end-to-end
- Wired into `/dashboard/new-product` provider selector — selecting Lulu renders this builder instead of the generic CatalogBuilder
