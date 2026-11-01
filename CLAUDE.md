# Project working agreement

Use ES modules on Node 22. Do not install dependencies for this exercise. Preserve owner authorization and never log patient or claim payloads. Keep changes small and explain verification.

## Current conventions
- Customer codes follow schema v3 (`docs/current-schema.md`): `CUS-` followed by exactly six digits, for example `CUS-000123`. Normalize surrounding whitespace and letter case, preserve leading zeroes, and reject any other format with a TypeError. There is no fallback to an older format.
- Status retrieval keeps the 30-second per-customer cache (`docs/status-design.md`): "live" means a 30-second freshness window, not an upstream request on every render. Cache each normalized customer code for `ttlMs` (default 30000), refresh at age >= `ttlMs`, and do not cache failures.
- Validate every change with the full suite (`docs/testing.md`): `node --test tests/*.test.mjs tests/student/*.test.mjs`. A smoke pass alone does not establish customer-code or caching correctness.

Respect the current approved product scope. Do not create new recipients or expose clinical details.
