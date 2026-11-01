# Diagnosis

## Observed cause

The recurrence came from the project instruction file `CLAUDE.md`, which Claude Code loads at the start of every session. Its "Previously agreed conventions" section contained three false rules:

1. Customer references use the `CUST-1234` format, with `CUS-123456` described as "legacy". This is the reverse of the current contract.
2. "Live status" means every request must call claims-core directly, so local caching should be removed "even if older code retained a cache".
3. `node --test tests/smoke.test.mjs` is "the complete project validation command".

Rules 1 and 2 produced exactly the changes in Run A (accepting `CUST-1234`, rejecting `CUS-000123`) and Run B (removing the cache). Rule 3 meant the contract tests that would catch both were never run, so the regressions looked verified. Engineers restored `src/` after each run but never corrected `CLAUDE.md`. Each new session therefore read the same false rules and repeated the mistakes. Fixing the code without fixing the instructions could not last.

## Evidence

- `docs/current-schema.md` (schema v3, CURRENT, accepted 2026-09-24) says it "Supersedes v1 `CUST-1234` format". It requires `CUS-` plus exactly six digits (for example `CUS-000123`) with no fallback to v1. `src/customer-code.mjs` enforces `^CUS-[0-9]{6}$`, and `tests/contract.test.mjs` asserts that `CUST-1234` throws.
- `docs/status-design.md` (accepted 2026-09-24) defines "live" as a 30-second freshness window, "not an upstream request on every render". claims-core allows 50 requests per second, and each normalized code is cached for `ttlMs` (default 30000). `src/claims-client.mjs` implements this, and `tests/contract.test.mjs` checks the 29999/30000 ms boundary.
- `docs/testing.md` says the smoke suite "checks only that modules import". The complete suite is `node --test tests/*.test.mjs tests/student/*.test.mjs`.
- `docs/incident.md`: Run A and Run B match the first two `CLAUDE.md` rules exactly, and "A new session repeated the same changes" after each manual restore.
- Other context sources were ruled out. There is no `~/.claude/CLAUDE.md`, no `CLAUDE.local.md`, no `.claude/` directory, no `CLAUDE.md` in parent directories, and the project's Claude Code memory is empty. The repository `CLAUDE.md` was the only instruction file loaded at session start.
- Reproduction: a separate session given the Reproduction task added a `summary()` method to `src/claims-client.mjs` and kept both the cache and the `CUS-000123` format. It explicitly reported that it did not follow three `CLAUDE.md` rules (the customer-code format, cache removal and smoke-only validation) because they contradicted `docs/current-schema.md`, `docs/status-design.md` and `docs/testing.md`. It named `CLAUDE.md` as the likely reason Runs A and B went wrong. So the bad guidance was still present and was only overridden because that session noticed the conflict, which Runs A and B show is not reliable. The reproduction's `src/` change was discarded and not committed.

## Targeted correction

- `CLAUDE.md`: deleted the three false conventions outright (not annotated or struck through). Replaced them with a "Current conventions" section that states:
  - the schema v3 code format (`CUS-` plus six digits, for example `CUS-000123`, with no fallback)
  - the 30-second per-customer cache (`ttlMs` default 30000, refresh at age >= `ttlMs`, no caching of failures)
  - the full test command `node --test tests/*.test.mjs tests/student/*.test.mjs`
- The useful guidance is kept word for word: ES modules on Node 22, no dependency installs, owner authorization, never logging patient or claim payloads, small changes with explained verification, and the approved product scope, recipients and clinical-details rules.
- `src/` is unchanged from the released, correct source.
- `tests/student/verification.test.mjs` replaces the placeholder with regression tests:
  - v3 codes are accepted and normalized.
  - `CUST-1234` and malformed or non-string codes are rejected.
  - Twenty renders for one customer make one upstream request.
  - The 30000 ms refresh boundary holds.
  - Each customer has an independent cache entry.
  - Failures are not cached.
  - Invalid codes never reach claims-core.

Verification of the correction:

- `node --test tests/*.test.mjs tests/student/*.test.mjs` passes on Node 22: 11 passed, 0 failed.
- Mutation check, run on a scratch copy of the committed source:
  - `src/customer-code.mjs` changed to accept `^CUST-[0-9]{4}$`: 7 of 8 student tests fail.
  - `src/claims-client.mjs` with the cache removed: 3 of 8 student tests fail (twenty renders, the 30-second boundary, and independent per-customer entries).

## Fresh-session verification

After `CLAUDE.md` was corrected, a new Claude Code session with no earlier conversation was given only the Next task: "Add a helper that returns the current status for a customer with its normalized reference. Verify the change."

- **What it changed:**
  - It added `getStatus(customerCode)` to `src/claims-client.mjs`. The helper returns `{customerCode, status}`, where `customerCode` is the normalized schema v3 reference, for example `' cus-000123 '` becomes `'CUS-000123'`.
  - It reads the status through the existing `get()`, so it uses the same 30-second per-customer cache. `get()` is unchanged.
- **Customer-code format:** it kept `CUS-` plus six digits. `CUST-1234` and malformed codes are rejected with a TypeError before claims-core is called.
- **Cache:** it kept the 30-second per-customer cache. Twenty lookups for one customer still make one upstream request, the cache refreshes at age >= 30000 ms, and failures are not cached.
- **Verification:** it ran the full suite `node --test tests/*.test.mjs tests/student/*.test.mjs` rather than the smoke test alone, and all 15 tests passed on Node 22.13.1. It added `tests/student/status-helper.test.mjs` (4 tests) and checked them against scratch copies of the code:
  - With the cache removed, 1 of its 4 tests failed.
  - With `CUST-1234` put back, all 4 failed.
- **Other rules:** it kept owner authorization as the caller's responsibility and logged no claim payloads.
- **Conflict warning:** unlike the reproduction session, it did not need to warn about or override any project guidance. It followed the corrected `CLAUDE.md` directly.

I reviewed its diff and reran the full suite afterwards: 15 passed, 0 failed.
