# Implementation Plan: GonkaGate Kilo Setup

## Overview

This plan breaks the draft PRD into ordered, verifiable implementation tasks.
It preserves the current repository truth: `kilo-setup` is still a scaffold,
the production installer is not shipped yet, and production readiness cannot be
claimed until the PRD proof gates are closed.

## Repository Truth To Preserve

- The current CLI parses the intended public surface and reports scaffold
  status.
- No Kilo config files, secrets, `auth.json`, `.env` files, or shell profiles
  are modified until runtime installer behavior is implemented and tested.
- The first compatibility profile is exact `@kilocode/cli@7.2.0`; `7.2.5` is
  not implicitly supported.
- The current GonkaGate transport remains `chat/completions`; do not claim
  `responses` support.
- Never accept a plain `--api-key` flag, never print `gp-...` keys, never store
  secrets in project-local files, and never print raw `kilo debug config`
  output.
- Project scope is commit-safe for secrets, but it still requires each machine
  to have a compatible user-level `provider.gonkagate` definition.

## Task List

### Phase 1: Contract And Proof Gates

## Task 1: Stabilize Runtime Result Contracts

**Description:** Replace the single scaffold-only `not_implemented` result
shape with a runtime-ready result model that can represent blocked, installed,
failed, rolled-back, and still-not-implemented states without exposing secret
material.

**Acceptance criteria:**

- [ ] CLI JSON has stable status and error-code fields for runtime outcomes.
- [ ] Human and JSON renderers redact secret-bearing text.
- [ ] Scaffold output stays truthful until runtime installer behavior is
      enabled.

**Verification:**

- [ ] Tests pass: focused CLI renderer and contract tests.
- [ ] Typecheck passes: `npm run typecheck`.
- [ ] Manual check: scaffold output does not claim config writes or installer
      success.

**Dependencies:** None.

**Files likely touched:**

- `src/install/contracts.ts`
- `src/cli/contracts.ts`
- `src/cli/render.ts`
- `test/cli.test.ts`

**Estimated scope:** Medium: 3-5 files.

## Task 2: Add The Exact Kilo 7.2.0 Compatibility Profile

**Description:** Implement Kilo command discovery, version parsing, and profile
selection for exact `@kilocode/cli@7.2.0`, using `kilo` first and `kilocode` as
the fallback alias.

**Acceptance criteria:**

- [ ] Missing `kilo` and `kilocode` stop with install guidance.
- [ ] Exact `7.2.0` selects the supported compatibility profile.
- [ ] `7.2.5` and unknown version output are blocked unless a test harness
      explicitly injects support.
- [ ] The selected command and version can be recorded in install state.

**Verification:**

- [ ] Tests pass: command-discovery and version-parsing unit tests with fake
      command runners.
- [ ] Typecheck passes: `npm run typecheck`.
- [ ] Manual check: diagnostics name `kilocode` only as fallback and send happy
      path users back to plain `kilo`.

**Dependencies:** Task 1.

**Files likely touched:**

- `src/install/kilo.ts`
- `src/install/contracts.ts`
- `src/install/verification-notes.ts`
- `test/`

**Estimated scope:** Medium: 3-5 files.

## Task 3: Close The Curated Model Proof Gate

**Description:** Prove the selected GonkaGate model for Kilo production use, or
keep it out of validated defaults until live GonkaGate/Kilo smoke evidence and
a numeric `limit.output` value exist.

**Acceptance criteria:**

- [ ] The registry does not offer a production default without a numeric
      `limit.output`.
- [ ] Runtime config omits `limit.input`.
- [ ] Live smoke uses only safe secret sources such as an already-set
      `GONKAGATE_API_KEY` or a hidden prompt.
- [ ] Evidence notes record whether tool behavior and `chat/completions`
      transport passed.

**Verification:**

- [ ] Tests pass: registry and config-shape tests.
- [ ] Manual check: no default model is marked `validated` without proof.
- [ ] Manual check: smoke notes do not contain raw secrets or raw
      secret-bearing `kilo debug config` output.

**Dependencies:** Task 1.

**Files likely touched:**

- `src/constants/models.ts`
- `docs/specs/kilo-setup-prd/compatibility-spike-notes.md`
- `test/`

**Estimated scope:** Medium: 3-5 files.

## Checkpoint: Contract And Proof Gates

- [ ] Focused tests pass for CLI contracts and the compatibility profile.
- [ ] Repository docs still truthfully say the installer is not production-ready
      until the proof gates are closed.
- [ ] `npm run ci` passes before merging public CLI contract changes.

### Phase 2: Secrets And Config Writes

## Task 4: Implement Safe Secret Intake

**Description:** Add secret input support for hidden prompt,
`GONKAGATE_API_KEY`, and `--api-key-stdin`, while keeping `--api-key` and
positional secret arguments unsupported.

**Acceptance criteria:**

- [ ] Hidden prompt, env, and stdin secret paths are supported.
- [ ] Plain `--api-key` remains rejected.
- [ ] Non-interactive mode fails clearly when no safe secret source exists.
- [ ] Secret-bearing values are redacted in human output, JSON output, and
      fallback entrypoint errors.

**Verification:**

- [ ] Tests pass: secret source priority, stdin handling, and redaction tests.
- [ ] Typecheck passes: `npm run typecheck`.
- [ ] Manual check: docs and help do not show inline
      `GONKAGATE_API_KEY=gp-... npx ...` examples.

**Dependencies:** Task 1.

**Files likely touched:**

- `src/install/secrets.ts`
- `src/cli/parse.ts`
- `src/cli/execute.ts`
- `test/`

**Estimated scope:** Medium: 3-5 files.

## Task 5: Add Managed Secret Storage

**Description:** Store the GonkaGate API key only in installer-managed user
storage, repair POSIX owner-only permissions when possible, and avoid over-
claiming native Windows ACL behavior.

**Acceptance criteria:**

- [ ] The managed secret path resolves to `~/.gonkagate/kilo/api-key` or the
      native Windows equivalent under `%USERPROFILE%`.
- [ ] Project files never receive the secret value or secret file path.
- [ ] An unchanged secret is not rewritten.
- [ ] POSIX permissions are repaired when safe.
- [ ] Native Windows behavior is documented as inherited user-profile ACLs only
      unless explicit ACL hardening is implemented and tested.

**Verification:**

- [ ] Tests pass: temp-HOME filesystem tests.
- [ ] Tests pass: POSIX mode assertions on supported platforms.
- [ ] Manual check: no `.env`, `auth.json`, or shell-profile writes.

**Dependencies:** Task 4.

**Files likely touched:**

- `src/install/secrets.ts`
- `src/install/paths.ts`
- `src/constants/gateway.ts`
- `test/`

**Estimated scope:** Medium: 3-5 files.

## Task 6: Add Conservative JSON And JSONC Config Writes

**Description:** Implement config read/modify/write behavior for Kilo user and
project targets with backups outside the project tree, while preserving
unrelated config.

**Acceptance criteria:**

- [ ] User target selection follows `kilo.jsonc`, then `kilo.json`, then create
      `kilo.jsonc`.
- [ ] Project target selection follows `.kilo/kilo.jsonc`, then
      `.kilo/kilo.json`, then create `.kilo/kilo.jsonc`.
- [ ] The installer does not default-write `config.json`, `opencode.json`, or
      `opencode.jsonc`.
- [ ] Backups are written under `~/.gonkagate/kilo/backups/user-config` and
      `~/.gonkagate/kilo/backups/project-config`.
- [ ] Unrelated JSON/JSONC fields are preserved.

**Verification:**

- [ ] Tests pass: JSON and JSONC fixture tests.
- [ ] Tests pass: backup and rollback fixture tests.
- [ ] Manual check: generated project config remains commit-safe.

**Dependencies:** Tasks 1 and 5.

**Files likely touched:**

- `src/install/`
- `src/json.ts`
- `test/`

**Estimated scope:** Medium: 3-5 files.

## Task 7: Implement Scope Activation

**Description:** Apply the PRD scope model: user scope writes provider and
activation settings to user config, while project scope writes provider config
to user config and activation settings only to project config.

**Acceptance criteria:**

- [ ] User scope writes the provider definition and active `model` to user
      config.
- [ ] Project scope writes the provider definition to user config and only
      activation to project config.
- [ ] Project config contains no secret, no secret file path, and no
      `provider.gonkagate.options.apiKey`.
- [ ] `small_model` is not written by default.
- [ ] Scope switches remove only installer-owned stale activation from the old
      target.

**Verification:**

- [ ] Tests pass: user-scope, project-scope, rerun, and scope-switch fixtures.
- [ ] Manual check: generated provider config writes only
      `options.baseURL`, not a full `chat/completions` URL.
- [ ] Manual check: runtime config omits `limit.input`.

**Dependencies:** Tasks 3 and 6.

**Files likely touched:**

- `src/install/`
- `test/`

**Estimated scope:** Medium: 3-5 files.

## Checkpoint: Secrets And Config Writes

- [ ] Secret and config writer tests pass.
- [ ] Manual fixture review confirms no `.env`, `auth.json`, shell profile, or
      project secret writes.
- [ ] `npm run ci` passes.

### Phase 3: Verification And Blockers

## Task 8: Build The 7.2.0 Local Resolver

**Description:** Resolve locally inspectable Kilo config layers for the exact
`7.2.0` profile without invoking real-path Kilo commands.

**Acceptance criteria:**

- [ ] Global config order is modeled as `config.json`, `kilo.json`,
      `kilo.jsonc`, `opencode.json`, `opencode.jsonc`.
- [ ] Project-root and directory config orders follow the PRD profile.
- [ ] `KILO_CONFIG`, `KILO_CONFIG_DIR`, home-level directories,
      `KILO_CONFIG_CONTENT`, and readable managed config are included as
      inspectable layers.
- [ ] The durable resolver can run without `KILO_CONFIG_CONTENT` when proving
      the plain-`kilo` outcome.

**Verification:**

- [ ] Tests pass: precedence fixture matrix.
- [ ] Tests pass: durable resolver and current-session resolver scenarios.
- [ ] Manual check: resolver output is treated as secret-bearing before
      rendering.

**Dependencies:** Task 6.

**Files likely touched:**

- `src/install/`
- `test/`

**Estimated scope:** Medium: 3-5 files.

## Task 9: Add Blocker Attribution

**Description:** Convert resolver mismatches into redacted, actionable blocker
diagnostics for the user and for machine-readable JSON output.

**Acceptance criteria:**

- [ ] Detect `KILO_CONFIG`, `KILO_CONFIG_DIR`, home-level directory, and
      `KILO_CONFIG_CONTENT` blockers.
- [ ] Detect provider shape mismatch, missing curated model entry, provider
      allow/deny, provider whitelist/blacklist, and secret-binding provenance
      mismatch.
- [ ] Treat `disabled_providers` as stronger than `enabled_providers` when both
      mention `gonkagate`.
- [ ] Report inferred remote or Kilo-managed influence only when no locally
      inspectable layer explains resolver/oracle divergence.

**Verification:**

- [ ] Tests pass: targeted blocker attribution tests.
- [ ] Tests pass: redacted human and JSON output tests.
- [ ] Manual check: diagnostics do not print raw resolved config or raw
      secrets.

**Dependencies:** Task 8.

**Files likely touched:**

- `src/install/`
- `src/cli/render.ts`
- `test/`

**Estimated scope:** Medium: 3-5 files.

## Task 10: Add The XDG-Isolated Kilo Oracle

**Description:** Mirror supported-profile config inputs into a sandbox with fake
secrets and run `kilo debug config` as a compatibility oracle, not as the
durable production success gate.

**Acceptance criteria:**

- [ ] Oracle sets `HOME`, `XDG_CONFIG_HOME`, `XDG_DATA_HOME`,
      `XDG_CACHE_HOME`, and `XDG_STATE_HOME` before invoking Kilo.
- [ ] Oracle uses fake secret material only.
- [ ] Raw `kilo debug config` output never reaches user-facing logs,
      diagnostics, JSON output, or fallback errors.
- [ ] Oracle result is compared against the local resolver for the supported
      profile.

**Verification:**

- [ ] Integration check runs with
      `npm exec --yes --package @kilocode/cli@7.2.0 -- kilo ...`.
- [ ] Integration check runs with
      `npm exec --yes --package @kilocode/cli@7.2.0 -- kilocode ...`.
- [ ] Tests pass: redaction and sandbox-path assertions.

**Dependencies:** Tasks 2 and 8.

**Files likely touched:**

- `src/install/`
- `test/`
- `scripts/`

**Estimated scope:** Medium: 3-5 files.

## Task 11: Prove Native Windows Oracle Safety

**Description:** Add or document a native Windows runner proof that the sandbox
oracle and npm invocation do not touch real user paths outside the declared
sandbox and installer-owned targets.

**Acceptance criteria:**

- [ ] Native Windows run covers both `kilo` and `kilocode`.
- [ ] Sandbox variables include `HOME`, `USERPROFILE`, `HOMEDRIVE`,
      `HOMEPATH`, `XDG_CONFIG_HOME`, `XDG_DATA_HOME`, `XDG_CACHE_HOME`,
      `XDG_STATE_HOME`, `KILO_TEST_MANAGED_CONFIG_DIR`, runtime override vars,
      temp vars, and npm cache vars as required by the PRD.
- [ ] Before/after diff covers real user, `ProgramData`, `AppData`, npm cache,
      temp, and shell-profile candidates.
- [ ] Evidence is documented before production-ready support is claimed.

**Verification:**

- [ ] GitHub Actions `windows-latest` integration job passes, or an equivalent
      native VM proof is recorded.
- [ ] Manual check: Windows docs do not claim ACL hardening beyond implemented
      behavior.

**Dependencies:** Task 10.

**Files likely touched:**

- `.github/workflows/`
- `scripts/`
- `docs/specs/kilo-setup-prd/compatibility-spike-notes.md`
- `test/`

**Estimated scope:** Medium: 3-5 files.

## Checkpoint: Verification And Blockers

- [ ] Resolver and oracle agree on supported-profile fixtures.
- [ ] Blocker diagnostics are redacted and actionable.
- [ ] Windows proof exists before production-ready native Windows claims.

### Phase 4: User Flows

## Task 12: Enable Interactive Setup

**Description:** Replace scaffold-only execution with an interactive install
flow that detects Kilo, shows the installed version, offers curated model
choices, recommends scope, accepts a hidden secret, writes config, verifies, and
ends by sending the user back to plain `kilo`.

**Acceptance criteria:**

- [ ] Interactive flow shows the selected Kilo command and version.
- [ ] Model picker shows only validated curated choices.
- [ ] Project scope is recommended inside a git repository and user scope
      outside a git repository.
- [ ] Prompt text explains Kilo-specific scope effects in user language.
- [ ] Successful setup finishes with `Run kilo`.

**Verification:**

- [ ] Tests pass: prompt flow tests with injected prompt adapter.
- [ ] Tests pass: temp-HOME happy path for user and project scope.
- [ ] Manual check: happy path does not ask users to understand provider
      internals.

**Dependencies:** Tasks 3, 4, 7, and 9.

**Files likely touched:**

- `src/cli/execute.ts`
- `src/install/`
- `test/`

**Estimated scope:** Medium: 3-5 files.

## Task 13: Enable Non-Interactive Setup

**Description:** Support automation-safe non-interactive setup with `--yes`,
`--scope`, `GONKAGATE_API_KEY`, `--api-key-stdin`, and redacted JSON output.

**Acceptance criteria:**

- [ ] Non-interactive mode requires `--scope` or `--yes`.
- [ ] `--yes` accepts recommended defaults.
- [ ] A default model is auto-selected only when exactly one recommended
      validated model exists.
- [ ] Env and stdin secret paths work without exposing the secret.
- [ ] Blocked results are machine-readable and redacted.

**Verification:**

- [ ] Tests pass: CLI integration tests for env secret, stdin secret, and
      missing secret.
- [ ] Tests pass: JSON redaction tests.
- [ ] Manual check: docs do not recommend inline secret command examples.

**Dependencies:** Task 12.

**Files likely touched:**

- `src/cli/parse.ts`
- `src/cli/execute.ts`
- `src/cli/render.ts`
- `test/`

**Estimated scope:** Medium: 3-5 files.

## Task 14: Add Rollback And Rerun Idempotency

**Description:** Make reruns the official migration path, and roll back
installer-authored writes when durable local-resolver verification fails.

**Acceptance criteria:**

- [ ] Reruns update only GonkaGate-owned provider, model, and activation keys.
- [ ] Unrelated Kilo config is preserved.
- [ ] Failed durable resolver verification rolls back changed
      installer-managed files.
- [ ] Rollback failure is reported separately with redacted diagnostics.
- [ ] `install-state.json` records installer package/version, Kilo
      command/version, model key, scope, transport contract, config targets,
      `lastDurableSetupAt`, and compatibility audit version.

**Verification:**

- [ ] Tests pass: rerun idempotency, scope migration, rollback, and rollback
      failure fixtures.
- [ ] Manual check: no unknown user config is silently deleted.

**Dependencies:** Tasks 7 and 9.

**Files likely touched:**

- `src/install/`
- `test/`

**Estimated scope:** Medium: 3-5 files.

## Checkpoint: User Flows

- [ ] Interactive and non-interactive happy paths pass in temp HOME.
- [ ] Failed verification rolls back changed installer-owned files.
- [ ] `npm run ci` passes.

### Phase 5: Truthfulness And Release

## Task 15: Update Docs And Contributor Guidance

**Description:** Update docs and repository guidance to match shipped behavior,
while keeping Kilo/OpenCode distinctions and production limits explicit.

**Acceptance criteria:**

- [ ] `README.md`, `AGENTS.md`, relevant docs under `docs/`, and
      `CHANGELOG.md` match shipped behavior.
- [ ] Project-scope docs state that repository activation still requires each
      participating machine to have a compatible user-level
      `provider.gonkagate` definition.
- [ ] Docs do not claim `responses` support.
- [ ] Docs do not show inline `GONKAGATE_API_KEY=gp-... npx ...` examples.
- [ ] Docs state that real-path Kilo verification is not the production default
      unless that policy changes in a later proof gate.

**Verification:**

- [ ] Tests pass: docs contract tests.
- [ ] Format check passes: `npm run format:check`.
- [ ] Manual check: Kilo-specific config names and env vars are not replaced by
      OpenCode defaults.

**Dependencies:** Tasks 12, 13, and 14.

**Files likely touched:**

- `README.md`
- `AGENTS.md`
- `CHANGELOG.md`
- `docs/`
- `test/docs-contract.test.ts`

**Estimated scope:** Medium: 3-5 files.

## Task 16: Run Production Readiness Pass

**Description:** Perform the final release-readiness audit against the PRD
acceptance criteria before claiming production installer support.

**Acceptance criteria:**

- [ ] All PRD production blockers are closed or explicitly documented as not
      shipped.
- [ ] Product/legal review confirms `@gonkagate/kilo-setup` for public
      publishing.
- [ ] Package metadata, binary names, docs, tests, and CI agree on the same
      public contract.
- [ ] No production-ready claim is made for unproven Kilo versions, unproven
      model limits, native Windows behavior, real-path Kilo verification, or
      `responses` transport.

**Verification:**

- [ ] Full validation passes: `npm run ci`.
- [ ] Package check passes: `npm run package:check`.
- [ ] Manual check: PRD production-readiness checklist is reviewed.

**Dependencies:** Tasks 1-15.

**Files likely touched:**

- `README.md`
- `AGENTS.md`
- `CHANGELOG.md`
- `docs/`
- `package.json`
- `test/`

**Estimated scope:** Small: 1-2 files, unless readiness findings require fixes.

## Checkpoint: Complete

- [ ] All task acceptance criteria are met.
- [ ] `npm run ci` passes.
- [ ] PRD production blockers are closed or explicitly scoped out.
- [ ] Ready for human review before public release.

## Parallelization Opportunities

- Task 3 can run in parallel with Tasks 1 and 2 because the live GonkaGate proof
  does not depend on local installer writes.
- Task 11 can start after the oracle interface in Task 10 is sketched, but it
  cannot close before the oracle exists.
- Documentation drafts can start after Task 7, but final docs should wait until
  Tasks 12-14 land.
- Resolver and blocker tasks should stay sequential until the compatibility
  profile contract is stable.

## Risks And Mitigations

| Risk                                              | Impact | Mitigation                                                                                       |
| ------------------------------------------------- | ------ | ------------------------------------------------------------------------------------------------ |
| Treating `7.2.5` as patch-compatible with `7.2.0` | High   | Accept exact `7.2.0` only until a separate profile proves compatibility.                         |
| Writing an unproven model config                  | High   | Keep model `planned` until live smoke and numeric `limit.output` are proven.                     |
| Printing raw resolved config                      | High   | Treat resolver and oracle output as secret-bearing, and test redaction paths.                    |
| Project scope accidentally stores secrets         | High   | Keep provider secret binding user-level only and test project config fixtures.                   |
| Kilo verification touches real user paths         | High   | Use the local resolver as the durable success gate and run Kilo only in the XDG-isolated oracle. |
| Windows behavior is assumed from POSIX            | Medium | Require native Windows runner or VM proof before claiming support.                               |

## Open Questions

- What is the proven numeric `limit.output` for
  `qwen/qwen3-235b-a22b-instruct-2507-fp8`?
- Does the live GonkaGate/Kilo `chat/completions` smoke pass tool-call behavior
  for the selected model?
- Will product/legal approve `@gonkagate/kilo-setup` as the public package
  name?
- Should any later release add a `7.2.5` compatibility profile, or keep the
  first production release exact to `7.2.0` only?
