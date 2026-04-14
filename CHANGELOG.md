# Changelog

## [0.2.0](https://github.com/GonkaGate/kilo-setup/compare/v0.1.0...v0.2.0) (2026-04-14)


### Features

* add kilo setup docs and release automation ([984250e](https://github.com/GonkaGate/kilo-setup/commit/984250ea4a77857e0f8697ed03ebb988893adb95))
* add kilo setup docs and release automation ([e1eab13](https://github.com/GonkaGate/kilo-setup/commit/e1eab138aeb4ef5a3900ad6c3444352bdb14f488))


### Bug Fixes

* stabilize windows oracle and formatting checks ([ad918eb](https://github.com/GonkaGate/kilo-setup/commit/ad918ebb83c57aa35406f7d47190a9b82ff44469))
* stabilize windows oracle and formatting checks ([e3f2978](https://github.com/GonkaGate/kilo-setup/commit/e3f29781d45613a2af32e451a1f9b7971593bd84))

## Changelog

## Unreleased

- Fixed Windows CI so the oracle-proof script reuses the repository command
  runner instead of directly spawning bare `npm`, and added `.gitattributes`
  to keep LF line endings stable for `prettier --check` on `windows-latest`.
- Rewrote `README.md` and the user-facing docs for first-time GitHub/npm
  readers, including clearer setup paths, scope guidance, safe API key input
  rules, file locations, honest current limits, and direct GonkaGate site/docs
  links.
- Added checked-in `release-please` scaffolding and documented GitHub
  Actions plus npm trusted-publishing setup for automated versioning and
  `npm publish --provenance --access public` releases.
- Documented conventional release-title rules in `AGENTS.md` so future
  `release-please` style automation can infer version bumps from merged titles.
- Added a GitHub Actions npm trusted-publishing workflow with the `release`
  environment, tag/manual entrypoints, OIDC preflight checks, and provenance
  publishing for future releases.
- Bootstrapped the `@gonkagate/kilo-setup` TypeScript/Node package and copied
  the draft Kilo setup PRD into `docs/specs/kilo-setup-prd/spec.md`.
- Added phase-1 Kilo compatibility detection for exact `@kilocode/cli@7.2.0`
  with typed blocked JSON output.
- Expanded the runtime result contract and model proof-gate metadata without
  enabling config or secret writes yet.
- Added phase-2 install-layer foundations for safe secret intake, managed
  secret storage, JSON/JSONC config writes with backups, and scope-aware Kilo
  config ownership, while keeping the public CLI scaffold-only.
- Added phase-3 verification foundations for Kilo layer resolution, blocker
  attribution, structured blocked diagnostics, and an XDG-isolated oracle
  harness, while keeping the public CLI scaffold-only.
- Added phase-4 runtime user flows: git-aware scope selection, injected
  installer dependencies for CLI tests, managed install-state persistence,
  rollback-aware writes, real CLI orchestration, and installed/blocked/failed/
  rolled-back result rendering.
- Added phase-5 truthfulness and release-readiness alignment across CLI help,
  package metadata, docs, contributor guidance, and contract tests.
- Promoted the curated Qwen3 235B A22B Instruct 2507 FP8 profile to the
  shipped validated default, aligned the public transport contract to
  `chat/completions`, removed the installer-owned `limit.output` clamp, fixed
  JSON redaction so blocked results no longer emit `"undefined"` string
  fields, and added publish metadata for the GitHub repository and issue
  tracker.
