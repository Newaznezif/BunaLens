# Offline sync API contract

The mobile app may POST one queued capture to a trusted server endpoint after connectivity returns.

Request JSON:
- idempotency_key: stable local queue UUID.
- sample_type: red_cherry or green_bean.
- woreda: selected origin.
- lot_weight_kg: positive lot weight.
- captured_at: ISO-8601 capture timestamp.
- image_mime_type: image/jpeg, image/png or image/webp.
- image_base64: image bytes encoded as base64.

The endpoint must authenticate the station, enforce request/image size limits, store the image in the private coffee-samples bucket, call the secured Gemini inference service, derive prices from the server-side market benchmark table (never from model output), persist the assessment and return the canonical batch record.

Idempotency: enforce a unique (station_id, idempotency_key) constraint. A retry with the same key must return the existing record, not create a second batch or charge a second credit. Debit one credit only once after a valid successful assessment. Return 409 for a conflicting key/payload, and retryable 5xx for transient failures. Do not delete local images until the app confirms a successful canonical response.
