# AGENTS.md

## What This Repository Is

`kilo-setup` is the public open-source onboarding repository for the GonkaGate
CLI that configures local Kilo to use GonkaGate without requiring users to
hand-edit Kilo config, put secrets into repository files, or learn Kilo
provider internals.

Recommended public flow:

```bash
npx @gonkagate/kilo-setup
```

Current honest state:

- the real installer runtime is implemented under `src/install/`
- the public CLI detects local Kilo, resolves model and scope, accepts safe
  secret input, writes managed files, verifies the durable/current-session
  result, renders installed, blocked, failed, or rolled-back outcomes, and
  now auto-selects the recommended interactive scope unless a rerun needs an
  explicit scope-change confirmation
- when setup is launched from an active `kilo` terminal session, durable
  verification now strips session-only `KILO_CONFIG`, `KILO_CONFIG_DIR`, and
  `KILO_CONFIG_CONTENT` overrides before proving the plain-`kilo` outcome, and
  then reports the still-overridden current shell separately
- project-scope installs now surface Kilo global UI-model cache notices and
  support optional `--clear-kilo-model-cache` cleanup for the current cached
  selection, while staying explicit that Kilo can recreate that cache later
- the XDG-isolated oracle now mirrors user-level global Kilo config into the
  sandbox XDG config tree so project-scope verification matches the local
  resolver on supported `@kilocode/cli@7.2.0` installs, and that temporary
  sandbox now stages outside the repository with cleanup after verification
- the stock public build now ships one validated curated default,
  `qwen/qwen3-235b-a22b-instruct-2507-fp8`, with installer-managed
  `limit.output = 8192` for Kilo `7.2.0` compatibility
- exact support remains pinned to `@kilocode/cli@7.2.0`; later `7.2.x`
  versions are not implied
- native Windows production support is not yet claimed because the native
  oracle-safety proof gate is still open
- repository-side release automation is now checked in through
  `release-please` plus npm trusted-publishing workflows, but the external
  GitHub `release` environment and npm Trusted Publisher setup are still
  required before the first automated publish

If the implementation status, package name, version baseline, security flow,
config locations, scope model, verification policy, or transport contract
changes, update this file immediately so it stays truthful.

## Product Goal

The intended happy path is:

1. user runs `npx @gonkagate/kilo-setup`
2. installer validates local `kilo` or fallback `kilocode`
3. installer offers curated validated Kilo model choices
4. installer auto-selects `project` inside a git repository or `user`
   otherwise, and only asks on interactive reruns when the previous
   installer-managed scope differs from the new recommendation
5. installer collects a GonkaGate key through a hidden prompt,
   `GONKAGATE_API_KEY`, or `--api-key-stdin`
6. installer writes the minimum safe Kilo config layers
7. for `project` installs, installer reports Kilo global UI-model cache risk
   and can clear the current cached model on request
8. installer verifies the durable Kilo result and the current session when
   runtime-only overrides are active
9. user returns to plain `kilo`

For `project` scope, repository config stays secret-free. Each participating
machine still needs a compatible user-level `provider.gonkagate` definition,
usually by running the installer on that machine.

## Fixed Product Invariants

These are repo-contract decisions, not casual refactors:

- npm package: `@gonkagate/kilo-setup`
- intended public entrypoint: `npx @gonkagate/kilo-setup`
- binary names: `kilo-setup` and `gonkagate-kilo`
- provider id: `gonkagate`
- canonical base URL: `https://api.gonkagate.com/v1`
- current transport target: `chat/completions`
- future `/v1/responses` support must be a migration, not a present claim
- primary command: `kilo`
- fallback alias: `kilocode`
- exact investigated Kilo compatibility profile: `@kilocode/cli@7.2.0`
- Kilo runtime env vars: `KILO_CONFIG`, `KILO_CONFIG_DIR`,
  `KILO_CONFIG_CONTENT`
- durable global target: `~/.config/kilo/kilo.jsonc`
- durable project target: `.kilo/kilo.jsonc`
- managed secret path: `~/.gonkagate/kilo/api-key`
- `project` scope writes only activation settings to repo-local config
- the user-level config owns the provider definition and the canonical
  `{file:~/.gonkagate/kilo/api-key}` binding
- installer success is based on effective Kilo config, not only file writes
- the local resolver is the durable success gate
- the XDG-isolated `kilo debug config` oracle is a compatibility check with
  fake secrets, not the production default verifier against real user paths
- real-path Kilo verification is not part of the current production default
- no plain CLI flag may carry the secret
- safe secret inputs are hidden prompt, `GONKAGATE_API_KEY`, and
  `--api-key-stdin`
- the installer must not write directly to `auth.json`, create `.env` files,
  or mutate shell profiles

## Security Invariants

- never print the GonkaGate `gp-...` key
- never accept secrets through plain `--api-key`
- never store the secret in repository-local files
- keep project config secret-free by default
- keep raw `kilo debug config` output treated as secret-bearing
- redact secret-bearing text on every user-facing error path, including
  fallback entrypoint handling
- on POSIX-supported platforms, managed-secret reruns repair drifted owner-only
  permissions in place when the secret contents already match
- on native Windows, managed user files must stay inside the current user's
  profile and rely only on inherited per-user ACL behavior unless explicit ACL
  hardening is implemented and proven

## Current Repository Truth

These are implementation facts today:

- `src/cli.ts` is the shipped public runtime entrypoint
- `src/cli/` owns parse, execute, and render seams for human and JSON output
- `src/install/` contains shipped Kilo detection, path resolution, secret
  intake, managed config writes, rollback, effective-config verification, and
  orchestration
- `src/constants/models.ts` now exposes a recommended validated production
  default with installer-managed `limit.output = 8192` in the written Kilo
  provider config
- `docs/specs/kilo-setup-prd/spec.md` is the copied Kilo setup PRD
- `docs/release-readiness.md` records the current production-readiness audit
- `.github/workflows/release-please.yml` and `.github/workflows/publish.yml`
  contain the checked-in release PR and npm publish automation
- `release-please-config.json` and `.release-please-manifest.json` keep
  package versioning aligned with `src/constants/contract.ts`
- `src/constants/contract.ts` keeps `cliVersion` marked with
  `x-release-please-version` so post-release version sync stays automatic
- `test/package-contract.test.ts`, `test/docs-contract.test.ts`, and
  `test/cli.test.ts` protect the shipped runtime contract
- mirrored skill packs live under `.agents/skills/` and `.claude/skills/`

## Change Discipline

When behavior changes:

- update `AGENTS.md`
- update `README.md`
- update relevant docs under `docs/`
- update `CHANGELOG.md` for meaningful user or contributor changes
- update tests under `test/`
- keep Kilo/OpenCode distinctions explicit
- keep mirrored `.agents/skills/` and `.claude/skills/` assets aligned when
  the shared skill pack changes
- add runtime behavior tests before claiming a new end-user capability

Validation baseline:

```bash
npm run ci
```

## Release Title Discipline

This repository should stay compatible with `release-please` style versioning.

When release automation is enabled, the title that lands on `main` is what
matters most. In practice, that usually means:

- if you squash-merge, the PR title becomes the release-relevant commit title
- if you create a merge commit, the merged title on `main` still needs to stay
  conventionally releasable
- local commit messages can be helpful, but they do not help `release-please`
  if the final title on `main` is vague

Use conventional-commit style titles for releasable changes:

- `fix: ...` for a user-visible bug fix that should produce a patch release
- `feat: ...` for a new user-visible capability that should produce a minor
  release
- `feat!: ...` or `fix!: ...` for a breaking change that should produce a
  major release
- `BREAKING CHANGE:` in the body/description also marks a major change when
  your workflow preserves that metadata

Examples of good releasable titles:

- `fix: redact secret-bearing fallback entrypoint errors`
- `fix: reject unsupported kilo patch releases during detection`
- `feat: add non-interactive project-scope setup flow`

Examples to avoid:

- `update readme`
- `misc fixes`
- `cleanup`
- `changes`

Contributor guidance:

- prefer short English titles in imperative form
- make the PR title releasable before merge instead of trying to repair the
  release afterward
- `docs:`, `chore:`, `test:`, and `refactor:` are usually not a release by
  themselves unless the repository config explicitly treats them as releasable
- when a releasable change has already landed without a conventional title,
  follow up with a small releasable PR so release automation can cut the next
  version
