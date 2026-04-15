# Changelog

## Unreleased

- Simplified the interactive happy path so the installer now auto-selects the
  recommended scope by location, asks about scope only on reruns that would
  change the previous installer-managed scope, and documents the advanced
  `--scope` override separately.
- Added project-scope notices for Kilo's global UI model cache plus an
  optional `--clear-kilo-model-cache` cleanup for the current cached
  selection.
- Restored installer-managed `limit.output = 8192` for the curated Qwen
  default after Kilo `7.2.0` oracle validation showed custom model entries
  fail without a numeric output limit.
- Fixed project-scope installs whose XDG-isolated oracle sandbox mirrored
  user-level global Kilo config into `HOME/.config` instead of the sandbox XDG
  config tree, which could falsely trigger rollback with
  `inferred_non_local` verification blockers.
- Fixed oracle verification so temporary sandbox trees no longer appear as
  untracked `home/`, `xdg/`, `npm-cache`, or mirrored `workspace/` paths
  inside the target repository; the sandbox now stages outside the repo and is
  cleaned up after verification.

## [0.3.0](https://github.com/GonkaGate/kilo-setup/compare/v0.2.4...v0.3.0) (2026-04-14)


### Features

* simplify scope selection and clear kilo model cache ([0278c56](https://github.com/GonkaGate/kilo-setup/commit/0278c56537946d3db1a3e26cbebd2d72c458e015))
* simplify scope selection and clear kilo model cache ([9d2d473](https://github.com/GonkaGate/kilo-setup/commit/9d2d473f5cf66a464603ba9871e71224875c6565))

## [0.2.4](https://github.com/GonkaGate/kilo-setup/compare/v0.2.3...v0.2.4) (2026-04-14)


### Bug Fixes

* restore kilo setup verification on 7.2.0 ([340fab8](https://github.com/GonkaGate/kilo-setup/commit/340fab87d8750533c598e7de65018a82a3b402cd))
* restore kilo setup verification on 7.2.0 ([d506776](https://github.com/GonkaGate/kilo-setup/commit/d506776e6ce126bfa1691f5164aa6d99b1647657))

## [0.2.3](https://github.com/GonkaGate/kilo-setup/compare/v0.2.2...v0.2.3) (2026-04-14)


### Bug Fixes

* avoid rollback in kilo terminal sessions ([f6c4412](https://github.com/GonkaGate/kilo-setup/commit/f6c4412ad13b0a1cb295e9a243ebecda1fa8a4c3))
* avoid rollback in kilo terminal sessions ([551e43f](https://github.com/GonkaGate/kilo-setup/commit/551e43f24b530297002b195ccd47516645e99000))

## [0.2.2](https://github.com/GonkaGate/kilo-setup/compare/v0.2.1...v0.2.2) (2026-04-14)


### Bug Fixes

* ignore changelog in prettier checks ([6bc136a](https://github.com/GonkaGate/kilo-setup/commit/6bc136acb9f74c282bc08c8e81f3da11aa560c23))
* ignore changelog in prettier checks ([d3babfd](https://github.com/GonkaGate/kilo-setup/commit/d3babfdecdbf01017fc6febb6cccd9fcb75ff172))

## [0.2.1](https://github.com/GonkaGate/kilo-setup/compare/v0.2.0...v0.2.1) (2026-04-14)


### Bug Fixes

* keep contract version in sync after release ([abd3a39](https://github.com/GonkaGate/kilo-setup/commit/abd3a3981888a031d5b40797eefd3b294d678804))
* keep contract version in sync after release ([2a19bff](https://github.com/GonkaGate/kilo-setup/commit/2a19bff7dd07038be6716c328d0186350ab8ef1c))

## [0.2.0](https://github.com/GonkaGate/kilo-setup/compare/v0.1.0...v0.2.0) (2026-04-14)


### Features

* add kilo setup docs and release automation ([984250e](https://github.com/GonkaGate/kilo-setup/commit/984250ea4a77857e0f8697ed03ebb988893adb95))
* add kilo setup docs and release automation ([e1eab13](https://github.com/GonkaGate/kilo-setup/commit/e1eab138aeb4ef5a3900ad6c3444352bdb14f488))


### Bug Fixes

* stabilize windows oracle and formatting checks ([ad918eb](https://github.com/GonkaGate/kilo-setup/commit/ad918ebb83c57aa35406f7d47190a9b82ff44469))
* stabilize windows oracle and formatting checks ([e3f2978](https://github.com/GonkaGate/kilo-setup/commit/e3f29781d45613a2af32e451a1f9b7971593bd84))

## Changelog

## Unreleased

- Fixed installs launched from an active `kilo` terminal session so
  session-only `KILO_CONFIG` and `KILO_CONFIG_DIR` overrides no longer force a
  rollback of an otherwise valid durable GonkaGate setup; the installer now
  keeps the durable writes and reports the current shell as still overridden.
- Fixed the release-please version sync seam by marking
  `src/constants/contract.ts` with `x-release-please-version`, matching the
  working pattern already used in `opencode-setup`.
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
