# GonkaGate `kilo` Setup PRD

Status: draft product contract for feasibility-to-implementation planning.
This document does not describe shipped behavior in this repository yet.

Last upstream check: April 14, 2026.

## Source Baseline

The original investigation request used the literal phrase `kilo-code cli`.
The upstream product should be identified here as:

- product name in docs: Kilo Code CLI or Kilo CLI
- command name: `kilo`
- secondary command alias: `kilocode`
- npm package: `@kilocode/cli`
- upstream repository: `Kilo-Org/kilocode`
- npm `latest` observed on April 14, 2026: `@kilocode/cli` `7.2.0`
- npm dist-tag `rc` observed on April 14, 2026: `7.2.5`
- official docs baseline language: Kilo version `1.0` and later

The release-channel mismatch matters. A public GonkaGate installer must not use
the broad `1.0+` docs statement as its only compatibility claim. It must pin
supported Kilo CLI versions or version ranges after local config experiments
and source audits for each compatibility profile. The npm `rc` dist-tag can
point at a normal semver release that has not become npm `latest`, so it must
not be treated as supported by implication.

Primary sources checked:

- Kilo CLI docs:
  <https://kilo.ai/docs/code-with-ai/platforms/cli>
- Kilo CLI command reference:
  <https://kilo.ai/docs/code-with-ai/platforms/cli-reference>
- Kilo settings docs:
  <https://kilo.ai/docs/getting-started/settings>
- Kilo custom models docs:
  <https://kilo.ai/docs/code-with-ai/agents/custom-models>
- Kilo OpenAI-compatible provider docs:
  <https://kilo.ai/docs/ai-providers/openai-compatible>
- Kilo `v7.2.0` source:
  <https://github.com/Kilo-Org/kilocode/tree/v7.2.0>
- Kilo `v7.2.5` source during PRD review:
  <https://github.com/Kilo-Org/kilocode/tree/v7.2.5>

Redacted evidence notes are preserved in
`docs/specs/kilo-setup-prd/compatibility-spike-notes.md`.

## Current Decision Summary

- The public package working name is `@gonkagate/kilo-setup`.
- The public command is expected to be `npx @gonkagate/kilo-setup`.
- The stable provider id is `gonkagate`.
- The first production compatibility profile should support exact
  `@kilocode/cli@7.2.0` only.
- `@kilocode/cli@7.2.5` needs its own compatibility profile before support is
  claimed.
- The npm package exposes both `kilo` and `kilocode` binaries through the same
  `bin/kilo` entrypoint.
- The main `@kilocode/cli` npm package is a platform-wrapper package; local
  version parsing and compatibility checks must use an actually installed CLI
  command rather than assuming the wrapper tarball alone is runnable.
- The smallest validated production URL shape is provider-level
  `options.baseURL = "https://api.gonkagate.com/v1"` with no provider-level
  `api` and no model-level `provider.api`.
- A full `.../chat/completions` URL must not be written to any Kilo base URL
  field; Kilo appends `chat/completions` through the OpenAI-compatible adapter.
- Production setup should leave `small_model` untouched by default.
- GonkaGate public sources prove the selected model's context window as `262K`
  tokens, interpreted for Kilo as `262144`.
- GonkaGate public OpenClaw guidance documents `maxTokens: 8192` for the
  selected model, which the installer writes as Kilo `limit.output`.
- No safe `GONKAGATE_API_KEY` was present during the spike, so live GonkaGate
  inference was not run. Production shipment still benefits from a safe live
  smoke, but the numeric `limit.output` value is now documented.

## Problem

GonkaGate needs a first-class setup utility for Kilo CLI users if Kilo's native
custom-provider path asks too much from end users. Today users must know:

- that GonkaGate should be configured as a custom provider
- Kilo's current config file names and precedence
- which Kilo config file is safe to edit for user or project scope
- the canonical GonkaGate base URL
- that GonkaGate currently targets `chat/completions`
- how to define a custom model entry under the provider
- how to supply the GonkaGate API key without putting it in git, shell history,
  process lists, logs, or Kilo's raw resolved-config output

The intended product pattern is the same class of experience as
`npx @gonkagate/opencode-setup`: one short setup command, safe secret intake,
minimal config writes, effective verification, then normal `kilo` usage.

This is not a straight port from OpenCode. Kilo is an OpenCode fork, but it has
Kilo-specific config names, env vars, docs drift, release channels, state
locations, and verification behavior.

## Users

Primary user:

- a developer with local Kilo CLI who wants GonkaGate available in `kilo`
  without manually editing provider config

Secondary user:

- a team that wants a repeatable project activation path without storing
  machine-specific provider definitions or secrets in a repository

Tertiary user:

- an automation user who wants a non-interactive setup flow that is safe enough
  for scripts and CI bootstrap steps

## Desired Behavior

The user runs:

```bash
npx @gonkagate/kilo-setup
```

The tool:

1. validates that local Kilo CLI is installed as `kilo` or `kilocode`
2. identifies the installed Kilo CLI version and channel
3. refuses versions without a supported compatibility profile
4. shows only curated GonkaGate model choices
5. lets the user choose `user` or `project` scope
6. accepts the GonkaGate API key through safe inputs only
7. writes the minimum safe Kilo config layers
8. stores the secret only in GonkaGate-managed user storage
9. verifies the durable plain-`kilo` outcome without printing raw resolved
   config
10. verifies the current shell when `KILO_CONFIG_CONTENT` or other runtime
    overrides are active
11. reports higher-precedence Kilo config blockers clearly
12. sends the user back to plain `kilo`

Interactive mode should:

- detect local `kilo`
- display installed Kilo CLI version
- show the curated model picker even if only one model is currently validated
- recommend `project` scope inside a git repository
- recommend `user` scope outside a git repository
- explain the Kilo-specific scope effect in user language
- ask for the GonkaGate API key through a hidden prompt
- write and verify
- finish with "Run `kilo`"

The tool should not ask users to understand Kilo provider internals during the
happy path.

## Scope

In scope:

- one public npm package for Kilo setup
- configuration of an already installed local Kilo CLI
- support for `kilo` as the primary command and `kilocode` as a fallback alias
- Kilo CLI version detection
- hidden or automation-safe GonkaGate secret input
- curated GonkaGate model picker
- `user` and `project` activation scopes
- managed user secret storage
- managed install-state storage
- JSON/JSONC config reads and conservative writes with backups
- effective-config verification with redacted diagnostics
- blocker attribution for Kilo-specific config layers that are locally
  inspectable
- future-safe migration path if GonkaGate later supports `responses`

Out of scope:

- installing Kilo CLI
- upgrading Kilo CLI automatically
- creating or modifying shell profiles
- generating `.env` files
- accepting a plain `--api-key` argument
- writing secrets to repository-local files
- writing directly to Kilo's `auth.json`
- depending on Kilo Gateway or Kilo account login
- runtime `/v1/models` discovery as the primary onboarding UX
- arbitrary custom base URLs
- arbitrary custom model IDs
- claiming GonkaGate `responses` support before validation
- live paid inference verification as the default install success gate
- support for Kilo VS Code extension settings beyond shared config files that
  the CLI itself resolves

## Constraints

### GonkaGate

- canonical base URL: `https://api.gonkagate.com/v1`
- current supported transport: `/v1/chat/completions`
- `/v1/responses` is not supported today unless separately revalidated
- setup must expose only curated, Kilo-validated model choices in the public
  setup flow
- the current planned model inherited from the OpenCode setup baseline is:
  `qwen/qwen3-235b-a22b-instruct-2507-fp8`
- that model must not become a non-interactive default or be described as
  validated until the Kilo compatibility spike proves the GonkaGate transport,
  model id, token limits, and tool behavior against the chosen compatibility
  profile

### Kilo CLI

Kilo's public config model overlaps with OpenCode but is not identical.

The verified `@kilocode/cli@7.2.0` package:

- exposes `kilo` and `kilocode` binaries
- stores global app paths under the XDG-style `kilo` app name
- reads global config from `~/.config/kilo/...`
- supports Kilo-preferred config files such as `kilo.jsonc` and `kilo.json`
- still reads OpenCode-style config files such as `opencode.jsonc` and
  `opencode.json`
- reads global config in this observed order, with later entries overriding
  earlier entries: `config.json`, `kilo.json`, `kilo.jsonc`,
  `opencode.json`, `opencode.jsonc`
- supports project config from the project root and from `.kilo`, `.kilocode`,
  and `.opencode` directories
- supports `KILO_CONFIG` as a custom config file layer
- supports `KILO_CONFIG_DIR` as an additional config-directory layer
- supports `KILO_CONFIG_CONTENT` as an inline runtime config layer
- scans home-level `.kilocode`, `.kilo`, and `.opencode` directories in
  addition to project-tree config directories
- supports file-based system managed config under Kilo-specific system paths
- supports `{env:...}` and `{file:...}` substitution in config text
- supports `provider.<provider_id>.models` for custom model registration
- supports `provider.<provider_id>.options.apiKey`
- supports `provider.<provider_id>.options.baseURL`
- supports `enabled_providers` and `disabled_providers`
- supports provider-level `whitelist` and `blacklist`
- exposes `kilo debug config`, but `@kilocode/cli@7.2.0` does not expose a
  documented `--pure` flag for that command
- prints substituted secret values in `kilo debug config` output
- documents optional `limit.input`, but the audited `7.2.0` source does not
  appear to preserve `limit.input` when building custom provider-defined
  models; the same gap was still visible in the `v7.2.5` source checked during
  PRD review

The audited `v7.2.5` source changed config behavior relative to `v7.2.0`,
including an additional account or organization config fetch after
`KILO_CONFIG_CONTENT` and before file-based managed config. Therefore, a
resolver proven against `7.2.0` must not claim support for later `7.2.x`
versions until those versions have their own compatibility profile or an
explicitly proven compatible range.

### Product

- setup must be easier than manual Kilo custom-provider configuration
- secrets must stay out of git
- unrelated Kilo config must be preserved
- project scope must be commit-safe by default
- effective Kilo config, not file writes alone, must determine success
- rerunning the installer must be the official migration path
- diagnostics must be clear without printing raw secret-bearing config

## Package Identity

Working package name:

- `@gonkagate/kilo-setup`

Working public command:

```bash
npx @gonkagate/kilo-setup
```

Stable provider identity:

- provider id: `gonkagate`
- display name: `GonkaGate`

Both `@gonkagate/kilo-setup` and `@gonkagate/kilocode-setup` were unclaimed on
npm during the April 14, 2026 spike. Keep `@gonkagate/kilo-setup` for
production unless product/legal review objects: it matches the public `kilo`
command and Kilo CLI docs, while still using `kilocode` as a discoverable
upstream-package keyword. The provider id should be stable unless Kilo reserves
or conflicts with that id.

## Compatibility Policy

First compatibility profile:

- audited package: `@kilocode/cli@7.2.0`
- supported version policy: exact `7.2.0` only until a broader compatibility
  range is proven
- required command: `kilo`
- fallback command: `kilocode`
- supported invocation for the sandbox oracle:
  `npm exec --yes --package @kilocode/cli@7.2.0 -- kilo ...` and
  `npm exec --yes --package @kilocode/cli@7.2.0 -- kilocode ...`, provided the
  verifier sets `HOME`, `XDG_CONFIG_HOME`, `XDG_DATA_HOME`, `XDG_CACHE_HOME`,
  and `XDG_STATE_HOME` before the Kilo process starts

Installer behavior:

- missing `kilo` and `kilocode`: stop with install guidance
- version without a supported compatibility profile: stop and request installing
  a supported Kilo CLI version
- version with a supported compatibility profile: continue using that profile's
  config-order, verification, and blocker-attribution rules
- unknown version output: stop unless explicitly running in a test harness

The installer must record the Kilo CLI version it verified in the managed
install state, along with the compatibility profile used for that version.

`@kilocode/cli@7.2.5` must not be accepted by the `7.2.0` profile. The spike
found matching provider URL and `limit.input` source behavior, but also found
profile-relevant drift:

- `kilo debug config --help` exposes `--pure` in `7.2.5` but not `7.2.0`
- the `debug paths` bin path changed from `data/kilo/bin` to `cache/kilo/bin`
- config loading adds account or organization config after
  `KILO_CONFIG_CONTENT` and before file-based managed config
- dependency install handling changed

Treat `7.2.5` as a likely later profile, not as an implicit patch-compatible
version.

## Secret Handling

Allowed inputs:

- hidden interactive prompt
- `GONKAGATE_API_KEY`
- `--api-key-stdin`

Disallowed inputs and writes:

- `--api-key`
- positional secret arguments
- writing the key into `.env`
- requiring users to export secrets in shell profiles
- writing the key into Kilo project config
- writing the key into Kilo `auth.json`

Plain CLI arguments can leak through shell history, logs, and process
inspection. Repository-local Kilo config is often commit-eligible. Kilo's
resolved-config output can print substituted secret values.

The installer stores the secret in GonkaGate-managed user storage:

- POSIX/macOS/WSL: `~/.gonkagate/kilo/api-key`
- native Windows: `%USERPROFILE%\.gonkagate\kilo\api-key`

The canonical installer-owned Kilo secret binding is:

```text
provider.gonkagate.options.apiKey = {file:~/.gonkagate/kilo/api-key}
```

The user-level provider config references the file through Kilo's `{file:...}`
substitution. The project-level activation config must not contain the secret,
the secret value, or the secret file path.

On POSIX-supported platforms, the secret directory and file should use
owner-only permissions. Reruns should repair drifted owner-only modes when the
secret contents already match, without rewriting the secret or creating a
backup.

On native Windows, managed files should stay under the current user's profile
and rely on inherited user-profile ACLs. The installer should not claim to
rewrite Windows ACLs unless that behavior is explicitly implemented and tested.

## Managed State

The installer writes:

- `~/.gonkagate/kilo/install-state.json`
- native Windows resolved path:
  `%USERPROFILE%\.gonkagate\kilo\install-state.json`

The state records:

- installer package name and version
- Kilo CLI command used
- Kilo CLI version detected
- selected GonkaGate model key
- selected scope
- current transport contract
- config write target paths
- `lastDurableSetupAt`
- compatibility audit version

`lastDurableSetupAt` means "last durably verified plain-`kilo` setup", not
"every possible current shell override also succeeded".

## Config Targets

Default durable user config target:

- `~/.config/kilo/kilo.jsonc`

User config write order:

- if `~/.config/kilo/kilo.jsonc` exists, write there
- else if `~/.config/kilo/kilo.json` exists, write there
- else create `~/.config/kilo/kilo.jsonc`
- do not write to `config.json`, `opencode.json`, or `opencode.jsonc` as the
  default target for new installs
- still inspect those files because Kilo may resolve them, and because
  `opencode.json` / `opencode.jsonc` can override the Kilo-preferred write
  target in the observed `7.2.0` global merge order

Observed `@kilocode/cli@7.2.0` global merge order, low to high precedence:

```text
config.json -> kilo.json -> kilo.jsonc -> opencode.json -> opencode.jsonc
```

Default project config target:

- if `.kilo/kilo.jsonc` exists, write project activation there
- else if `.kilo/kilo.json` exists, write project activation there
- else create `.kilo/kilo.jsonc`

Rationale:

- `.kilo/kilo.jsonc` is Kilo-specific
- keeping generated project activation under `.kilo/` avoids crowding the repo
  root
- the audited `7.2.0` source can miss project-root `kilo.jsonc` or `kilo.json`
  when `kilo` is launched from a nested directory, while `.kilo` directory
  config is discovered from the project tree
- JSONC allows future comment-preserving edits

The installer must inspect project-root `kilo.jsonc` and `kilo.json`, but for
the `7.2.0` compatibility profile it should not default-write activation there.
It also must inspect but should not default-write legacy KiloCode, OpenCode, or
generic config files. If those files override installer-managed settings, the
production behavior is a redacted blocker diagnostic, not automatic
reconciliation.

Observed `@kilocode/cli@7.2.0` project config order when `kilo` is launched from
the same directory as the project-root files, low to high precedence:

```text
project-root kilo.jsonc -> project-root kilo.json ->
project-root opencode.jsonc -> project-root opencode.json ->
.kilocode/* -> .kilo/* -> .opencode/*
```

Within each of `.kilocode`, `.kilo`, and `.opencode`, Kilo loads:

```text
kilo.jsonc -> kilo.json -> opencode.jsonc -> opencode.json
```

The default project target remains `.kilo/kilo.jsonc`, but an existing
`.opencode/opencode.json` or `.opencode/opencode.jsonc` can still win over it.
For `7.2.0`, project-root config discovery from nested working directories must
not be assumed. Later Kilo versions may use different root config discovery,
but that behavior needs a version-specific compatibility proof before changing
the default project write target.

Additional observed directory-config layers:

- Kilo also scans home-level `.kilocode`, `.kilo`, and `.opencode` directories.
- `KILO_CONFIG_DIR`, when set, is appended to the config-directory scan and can
  load the same `kilo.jsonc`, `kilo.json`, `opencode.jsonc`, and
  `opencode.json` filenames.
- The compatibility spike must reproduce the exact project-directory,
  home-directory, and `KILO_CONFIG_DIR` order before exact blocker attribution
  is implemented.

## Scope Model

`user` scope:

- write provider definition to user config
- write activation settings to user config
- keep secret and install state in GonkaGate-managed user storage
- remove only installer-owned stale GonkaGate activation from the old project
  target
- preserve unrelated user config

`project` scope:

- still write provider definition to user config
- still keep secret and install state in GonkaGate-managed user storage
- write only activation settings to Kilo project config
- keep project config secret-free and commit-safe
- remove only installer-owned stale GonkaGate activation from the old user
  activation target
- preserve unrelated project config

Project scope is commit-safe for secrets, but it is not automatically
team-portable. If `.kilo/kilo.jsonc` or another project activation file is
committed with `"model": "gonkagate/..."`, teammates who have not run the
installer and therefore do not have a user-level `provider.gonkagate`
definition can see an unknown-provider or unknown-model failure. The docs and
UX should phrase project scope as "activate this repository for machines that
have run the installer", not as a complete team bootstrap by itself.

Activation settings:

```jsonc
{
  "model": "gonkagate/qwen3-235b-a22b-instruct-2507-fp8",
}
```

Do not set `small_model` by default in production. Kilo resolves `small_model`
as a top-level `provider/model` value, so the field is technically usable for
custom provider models, but it is not scoped to GonkaGate activation. Writing it
by default would override an existing user or project small-model preference
for all Kilo sessions. If no `small_model` is set, the audited Kilo source
falls back to the active model when it cannot find a same-provider small-model
match. Production setup must not expose or write a GonkaGate-owned
`small_model` unless a separate small-model candidate is validated before
release. If no such candidate is validated, omit `small_model` entirely rather
than shipping an unproven fallback.

## Provider And Model Config

Expected production managed provider shape:

```jsonc
{
  "provider": {
    "gonkagate": {
      "name": "GonkaGate",
      "npm": "@ai-sdk/openai-compatible",
      "options": {
        "apiKey": "{file:~/.gonkagate/kilo/api-key}",
        "baseURL": "https://api.gonkagate.com/v1",
      },
      "models": {
        "qwen3-235b-a22b-instruct-2507-fp8": {
          "id": "qwen/qwen3-235b-a22b-instruct-2507-fp8",
          "name": "Qwen3 235B A22B Instruct 2507 FP8",
          "tool_call": true,
          "limit": {
            "context": 262144,
            "output": "BLOCKED_UNTIL_GONKAGATE_LIMIT_IS_PROVEN",
          },
        },
      },
    },
  },
}
```

The `output` string above is not valid runtime Kilo config. It is an explicit
PRD marker: production runtime config must not write the model until the real
numeric output limit is proven or the model is excluded from validated
defaults.

Provider URL decisions:

- write only `https://api.gonkagate.com/v1`, never the full
  `https://api.gonkagate.com/v1/chat/completions` endpoint
- use provider-level `options.baseURL` as the single production URL field
- do not write provider-level `api` by default
- do not write model-level `provider.api` by default
- keep `@ai-sdk/openai-compatible` as the provider package

Evidence:

- Kilo `7.2.0` source builds `model.api.url` from model-level `provider.api`,
  provider-level `api`, then existing model metadata, and later lets
  provider-level `options.baseURL` override the URL during SDK construction.
- `kilo models gonkagate --verbose` lists the model for all three base-URL
  candidates, but when only `options.baseURL` is set the verbose model
  `api.url` is null. Model listing alone is not a sufficient URL verifier.
- A local fake OpenAI-compatible `kilo run` smoke proved that
  `options.baseURL = http://127.0.0.1:<port>/v1` sends a streaming POST to
  `/v1/chat/completions` with the curated upstream model id and a Bearer header.
- The same fake smoke proved that writing a full `.../chat/completions` URL
  produces a doubled `/chat/completions/chat/completions` path.

The `limit.context` value is proven from the GonkaGate public model page as
`262K`, mapped to the integer `262144`. GonkaGate OpenClaw guidance documents
`maxTokens: 8192` for the same model, so the installer writes
`limit.output = 8192`. Kilo docs state that `context: 0` disables compaction and
context-size-dependent usage tracking, while `output: 0` falls back to Kilo's
internal output default. Do not use `0` as the production value for this model
unless a later PRD update explicitly accepts that trade-off.

Do not rely on `limit.input` in production config. Although current Kilo docs
describe it, audited `7.2.0` and `v7.2.5` source paths for config-defined
custom models drop it when constructing the runtime model object. The spike
also observed `limit.input` preserved in raw resolved config but absent from
`kilo models gonkagate --verbose`. Omit `limit.input` from production runtime
config and keep it only as future-compatible registry metadata if GonkaGate
publishes it.

The curated model registry must be able to carry:

- visible model key
- upstream model id
- display name
- transport kind
- adapter package
- provider-level options
- model-level options
- model headers
- Kilo-specific compatibility notes
- validation status

## Transport Strategy

Current production transport:

- `chat_completions`
- Kilo adapter package: `@ai-sdk/openai-compatible`
- GonkaGate base URL: `https://api.gonkagate.com/v1`

Kilo's OpenAI-compatible runtime path goes through the AI SDK provider
construction and language-model loading. The chosen config must be proven
against the actual request path Kilo uses for the selected model, not just
against the existence of OpenAI-compatible provider fields in config. This
installer must not claim `responses` support for GonkaGate until a dedicated
GonkaGate/Kilo validation proves it.

The April 14, 2026 spike proved Kilo's runtime path against a local fake
OpenAI-compatible server, not against live GonkaGate. A live GonkaGate/Kilo
`chat/completions` smoke remains required before marking the model validated,
and must be run only with a safe secret source such as an already-set
`GONKAGATE_API_KEY` or hidden prompt.

Future `/v1/responses` support should be a migration under the same provider id
and package identity, not a product rename.

## Config Precedence And Blockers

For `@kilocode/cli@7.2.0`, the effective config surface to account for is:

1. legacy KiloCode migrations and organization modes
2. remote `.well-known/opencode` config from well-known auth entries
3. global Kilo config under `~/.config/kilo`
4. `KILO_CONFIG`
5. project root config files
6. config directories discovered from the project tree
7. home-level `.kilocode`, `.kilo`, and `.opencode` directory config
8. `KILO_CONFIG_DIR`, if set
9. `KILO_CONFIG_CONTENT`
10. file-based system managed config

The summary above is the layer order. File order inside the global and project
layers must follow the observed `7.2.0` orders documented in Config Targets.
Later profiles must re-prove the order before claiming exact blocker
provenance.

The installer must not treat a write to `~/.config/kilo/kilo.jsonc` as success
until the resolved Kilo result matches the intended setup.

Exact blocker attribution is guaranteed only for locally inspectable layers:

- global config files under `~/.config/kilo`
- `KILO_CONFIG`
- project root config files
- project-tree `.kilocode`, `.kilo`, and `.opencode` directory config files
- home-level `.kilocode`, `.kilo`, and `.opencode` directory config files
- `KILO_CONFIG_DIR`
- `KILO_CONFIG_CONTENT`
- file-based system managed config

In the `7.2.0` profile, remote `.well-known/opencode` config and Kilo
organization modes are lower precedence than the installer-owned global config
for provider and model activation. They should not normally block a GonkaGate
provider written to user config. If the local resolver and sandbox oracle still
diverge and no locally inspectable layer explains the winner, report an
inferred remote or Kilo-managed configuration influence. The diagnostic must say
that exact provenance is unavailable locally; it must not name a precise remote
URL, organization, or account source unless Kilo exposes that provenance.

The installer must detect and report:

- `KILO_CONFIG`, `KILO_CONFIG_DIR`, or `KILO_CONFIG_CONTENT` overlapping
  GonkaGate-managed provider or activation keys
- home-level `.kilocode`, `.kilo`, or `.opencode` config overriding
  GonkaGate-managed provider or activation keys
- file-based system managed config overriding GonkaGate-managed keys
- project config overriding user-scope activation
- stale user config overriding project-scope activation
- `enabled_providers` that does not include `gonkagate`
- `disabled_providers` that includes `gonkagate`
- provider-level `whitelist` that excludes the selected GonkaGate model
- provider-level `blacklist` that includes the selected GonkaGate model
- provider block shape mismatches for `gonkagate`
- missing curated model entry
- secret-binding provenance mismatches

`disabled_providers` should be treated as stronger than `enabled_providers`
when both mention `gonkagate`.

## Secret-Binding Provenance

Resolved config alone is not proof of secret provenance because
`kilo debug config` prints substituted secret values.

The installer must verify provenance by inspecting the file-backed config
layers it writes and the higher-precedence layers it can inspect:

- user config must own the canonical
  `provider.gonkagate.options.apiKey = {file:~/.gonkagate/kilo/api-key}`
  binding
- project config must not define `provider.gonkagate.options.apiKey`
- `KILO_CONFIG` must not define `provider.gonkagate.options.apiKey`
- `KILO_CONFIG_DIR` must not define `provider.gonkagate.options.apiKey`
- home-level `.kilocode`, `.kilo`, and `.opencode` config must not define
  `provider.gonkagate.options.apiKey`
- `KILO_CONFIG_CONTENT` must not define
  `provider.gonkagate.options.apiKey` in production
- file-based system managed config must not define
  `provider.gonkagate.options.apiKey` unless a future enterprise-aware policy
  explicitly supports it

An identical inline `KILO_CONFIG_CONTENT` secret binding should still block in
production until Kilo-specific inline secret-binding parity is explicitly
accepted as a product decision.

## Verification

The core success gate is effective Kilo config, not file writes.

Available verification tool:

```bash
kilo debug config
```

Important constraints:

- `@kilocode/cli@7.2.0` does not document `kilo debug config --pure`.
- `@kilocode/cli@7.2.5` documents `kilo debug config --pure`, but production
  must not switch to it until a `7.2.5` profile proves redaction behavior and
  filesystem side effects.
- `kilo debug config` can print substituted secret values.
- Kilo config loading can write schema and migration updates to config files;
  observed `7.2.0` behavior can add `$schema` and migrate `permission.bash` in
  global config during a read path.
- Kilo config loading can also trigger config-directory dependency setup;
  observed `7.2.0` source can write `package.json`, `.gitignore`, lockfiles,
  or `node_modules` in writable scanned config directories.
- Invoking Kilo CLI commands can initialize or migrate Kilo-owned `data`,
  `cache`, `state`, and `log` locations, including first-run database
  migration and telemetry startup behavior.
- The April 14, 2026 sandbox runs observed Kilo writes only inside the sandbox:
  `data/kilo` database, storage, logs, and `telemetry-id`; `cache/kilo`
  metadata and dependencies; and config-directory dependency files under
  `config/kilo`.
- A before/after metadata hash over real user Kilo path candidates was
  unchanged after a fresh sandboxed `7.2.0` `kilo debug paths` run.
- `KILO_TEST_HOME` is not enough to sandbox all Kilo paths; `@kilocode/cli@7.2.0`
  computes config, data, cache, and state paths from XDG base-directory
  environment at module load, so a verifier sandbox must set `HOME`,
  `XDG_CONFIG_HOME`, `XDG_DATA_HOME`, `XDG_CACHE_HOME`, and `XDG_STATE_HOME`
  before invoking Kilo.
- Raw debug-config output must never be printed in user-facing logs,
  diagnostics, JSON output, or fallback error handling.

Production default verification is a two-step proof path:

1. Use an installer-owned local resolver for locally inspectable config layers,
   redaction, blocker attribution, and secret-binding provenance against the
   user's durable files. This is the only production durable success gate and
   the only basis for `lastDurableSetupAt`.
2. Use `kilo debug config` only as an XDG-isolated compatibility oracle over a
   sandbox mirror of the supported profile's config inputs. Real-path Kilo
   verification is a later explicit feature, not part of the production
   default, unless a separate compatibility spike proves an isolation and
   restore strategy that covers all relevant Kilo side effects.

The XDG-isolated oracle is not direct proof that the user's real durable paths
were read by Kilo, because the sandbox intentionally changes `HOME` and XDG
roots before Kilo's global paths are computed. Its job is to prove that Kilo
accepts the selected provider shape, substitution syntax, model selection, and
profile-specific precedence on mirrored inputs. The mirror must use fake
secrets only and must not copy a real GonkaGate API key into the sandbox.

The durable local-resolver pass should run with durable install inputs and
without `KILO_CONFIG_CONTENT` when proving the plain-`kilo` outcome. The
resolver must check:

- resolved `model`
- resolved `provider.gonkagate`
- provider adapter package
- base URL
- transport-relevant shape
- curated model entry
- provider allow/deny gating
- provider whitelist/blacklist gating

The sandboxed Kilo oracle should then run on a mirror of those durable inputs
with fake secret material to prove that Kilo's resolved output matches the local
resolver for the supported compatibility profile. A separate current-session
local-resolver pass should run with the invoking shell's runtime overrides
restored, including `KILO_CONFIG_CONTENT`, and report whether this specific
shell is still overridden away from the intended setup.

If any supported verifier path invokes a Kilo command against real durable user
or project paths, the installer must first create an in-memory verification
snapshot of every locally inspectable config file that exists and could be read
or migrated by that command:

- global config files under `~/.config/kilo`
- `KILO_CONFIG`, if set
- project root config files
- project-tree `.kilocode`, `.kilo`, and `.opencode` directory config files
- home-level `.kilocode`, `.kilo`, and `.opencode` directory config files
- `KILO_CONFIG_DIR`, if set
- file-based system managed config, if readable

That snapshot is not enough to cover Kilo-owned state initialization or
dependency-install side effects. Before any real-path Kilo verification is
implemented, the compatibility spike must either prove a safe no-install
verifier path for the chosen Kilo compatibility profile, or define a broader
filesystem-diff restore plan that covers writable config directories touched by
dependency setup.

If real-path verification fails, the installer should restore non-installer
files changed by the verification command where it has permission to do so, then
roll back installer-authored writes. If real-path verification succeeds,
Kilo-owned read-time migrations may remain, but the installer must not describe
verification as side-effect-free.

If Kilo adds a safe pure/debug command in a later version, the installer may
switch to it only after a compatibility audit updates this PRD. The audit must
prove both redaction behavior and filesystem side effects; a new flag name alone
is not enough.

## Backups And Rollback

Before replacing any managed config file, the installer must create a rollback
backup.

Managed user-file backups:

- under `~/.gonkagate/kilo/backups/user-config`

Project-config backups:

- under `~/.gonkagate/kilo/backups/project-config`

Rationale:

- avoid creating `*.bak` files beside repo-local config
- keep rollback material under profile-scoped user storage
- preserve project config commit safety

If writes succeed but later durable local-resolver verification fails, the
installer should roll back changed installer-managed files and report the
blocker. If a real-path Kilo verifier was run, it should also restore
verification-snapshot files that Kilo mutated during the failed verification and
restore non-config verification side effects where the approved verification
strategy covers them. If rollback or restoration fails, the installer must
report that separately with redacted file-path diagnostics.

## Rerun And Migration

Reruns are first-class.

The installer must:

- repair managed secret permissions on POSIX when possible
- preserve unrelated Kilo config
- update only GonkaGate-owned provider/model/activation keys
- remove only stale installer-owned activation from the old target when the
  user switches scope
- keep manual unrelated `model` or `small_model` values and surface them as
  blockers if they still win by precedence
- use `install-state.json` to migrate future provider shape changes
- never silently delete unknown user config

Migration examples:

- package rename or provider shape update
- adding required Kilo-specific model headers
- changing from provider-level `api` to model-level `provider.api`
- future `responses` transport support
- Kilo config precedence changes

## Non-Interactive Mode

Supported non-interactive inputs:

```bash
# GONKAGATE_API_KEY is already exported by a secret manager, CI, or wrapper.
npx @gonkagate/kilo-setup --scope project --yes
```

```bash
printf '%s' "$GONKAGATE_API_KEY" \
  | npx @gonkagate/kilo-setup --api-key-stdin --scope project --yes --json
```

The docs must not show an inline `GONKAGATE_API_KEY=gp-... npx ...` example.
That form is technically accepted by shells, but it puts the secret directly in
the command line and can end up in history, terminal transcripts, or automation
logs. The environment-variable path is intended for secrets already injected by
a secret manager, CI environment, or a previous hidden prompt.

Non-interactive rules:

- require `--scope` or `--yes`
- `--yes` accepts recommended defaults
- default model may be auto-selected only when exactly one recommended
  validated model exists
- no plain secret flag
- JSON output must redact secret-bearing fields
- blocked results should be machine-readable without exposing raw config

## Windows Support

Native Windows support is required for the production-ready support matrix.

Decision:

- production support includes macOS, Linux, WSL, and native Windows
- source inspection shows native Windows support is likely feasible for exact
  `@kilocode/cli@7.2.0`
- native Windows is a release blocker until the runner-backed proof gates below
  pass
- do not publish production-ready installer claims until the native Windows
  profile is proven on a real Windows runner or VM

Feasibility conclusion:

Native Windows should be supportable. The known blocker is not an incompatible
Kilo design; it is the missing native-run proof that the sandbox oracle and npm
invocation do not touch real user, `ProgramData`, `AppData`, npm cache, temp, or
shell-profile paths. WSL remains POSIX for paths and permission behavior.

Expected native Windows paths:

- global config: `%USERPROFILE%\.config\kilo\kilo.jsonc`
- managed secret: `%USERPROFILE%\.gonkagate\kilo\api-key`
- managed state: `%USERPROFILE%\.gonkagate\kilo\install-state.json`
- project config: `.kilo\kilo.jsonc` for the `7.2.0` compatibility profile
- Kilo data: `%USERPROFILE%\.local\share\kilo`
- Kilo bin: `%USERPROFILE%\.local\share\kilo\bin`
- Kilo logs: `%USERPROFILE%\.local\share\kilo\log`
- Kilo cache: `%USERPROFILE%\.cache\kilo`
- Kilo state: `%USERPROFILE%\.local\state\kilo`

Path evidence:

- `@kilocode/cli@7.2.0` still publishes native Windows optional packages for
  `x64`, `x64-baseline`, and `arm64`.
- both `kilo` and `kilocode` bins use the same wrapper entrypoint.
- Kilo `7.2.0` computes global `data`, `cache`, `config`, and `state` from
  `xdg-basedir` at module load, and `xdg-basedir@5.1.0` uses `XDG_*` variables
  first, falling back to `os.homedir()` plus `.local/share`, `.cache`,
  `.config`, and `.local/state`; it does not switch to `AppData` on Windows.
- Kilo's `{file:~/...}` substitution uses `os.homedir()`, so `KILO_TEST_HOME`
  alone is not sufficient for sandbox secret-path proof.
- Kilo's managed config directory defaults to `%ProgramData%\kilo` on native
  Windows unless `KILO_TEST_MANAGED_CONFIG_DIR` is set.

Native Windows production acceptance criteria:

- run the compatibility oracle on a real GitHub Actions `windows-latest` runner
  or equivalent native Windows VM for exact `@kilocode/cli@7.2.0`
- run both `kilo` and `kilocode` through `npm exec --yes` with
  `--package @kilocode/cli@7.2.0`
- set sandbox variables before the Kilo process starts: `HOME`, `USERPROFILE`,
  `HOMEDRIVE`, `HOMEPATH`, `XDG_CONFIG_HOME`, `XDG_DATA_HOME`,
  `XDG_CACHE_HOME`, `XDG_STATE_HOME`, `KILO_TEST_MANAGED_CONFIG_DIR`,
  `KILO_CONFIG`, `KILO_CONFIG_DIR`, `KILO_CONFIG_CONTENT`,
  `KILO_TELEMETRY_LEVEL=off`, `KILO_MACHINE_ID`, `KILO_DISABLE_MODELS_FETCH`,
  `KILO_DISABLE_LSP_DOWNLOAD`, `KILO_DISABLE_DEFAULT_PLUGINS`,
  `KILO_DISABLE_CLAUDE_CODE`, and `npm_config_cache` pointing inside the
  sandbox
- also sandbox temporary locations with `TMP` and `TEMP`, and include npm temp
  or cache-derived temp paths in the before/after filesystem diff if the npm
  version in CI uses them
- use fake secrets only, including the file referenced by
  `{file:~/.gonkagate/kilo/api-key}`
- diff sandbox and real-path candidates before and after the Kilo command,
  including `%USERPROFILE%\.config\kilo`, `%USERPROFILE%\.local\share\kilo`,
  `%USERPROFILE%\.cache\kilo`, `%USERPROFILE%\.local\state\kilo`,
  `%USERPROFILE%\.gonkagate\kilo`, `%ProgramData%\kilo`, `%APPDATA%`,
  `%LOCALAPPDATA%`, npm cache roots, and `%TEMP%`
- prove no writes occur outside the intended sandbox except npm's already
  documented package-cache area when that cache has also been sandboxed
- prove read-time side effects stay sandbox-contained, including `$schema`
  writes, `permission.bash` migration, config-directory package/dependency
  writes, Kilo database/storage/log/telemetry initialization, and npm/Bun cache
  writes
- document the native Windows secret-storage ACL policy as inherited
  user-profile ACLs only, unless explicit ACL hardening is implemented and
  tested
- add tests that native Windows setup writes only expected Kilo config and
  GonkaGate-managed paths and only after the native runner oracle succeeds

## Security Requirements

- never print the GonkaGate `gp-...` key
- never accept `--api-key`
- never write secrets into project config
- never write secrets into `.env`
- never write directly to Kilo `auth.json`
- never print raw `kilo debug config` output
- redact secret-bearing values from text and JSON diagnostics
- redact secret-bearing fallback entrypoint errors
- treat resolved config as secret-bearing
- preserve unrelated Kilo config touched by the installer
- back up before replacing managed files
- create verification snapshots before any real-path secret-bearing Kilo
  verification commands
- account for Kilo-owned data/cache/state/log and config-directory side effects
  before treating verification as rollback-safe
- roll back changed installer-managed files and restore verification-snapshot
  files after failed real-path verification where possible
- keep project scope commit-safe
- block higher-precedence secret-binding overrides in production
- do not mutate shell profiles
- do not require Kilo account auth

## Production Blockers

Production must not be claimed until:

- the supported Kilo compatibility profile is pinned and documented
- the provider config shape is proven against a live GonkaGate/Kilo
  `chat/completions` smoke path, including tool-call behavior, using only an
  already-set `GONKAGATE_API_KEY` or a hidden prompt
- the real numeric `limit.output` value is known for
  `qwen/qwen3-235b-a22b-instruct-2507-fp8`, or that model is excluded from
  validated defaults
- `limit.input` is excluded from production runtime config
- the local resolver, sandboxed Kilo oracle, redaction path, rollback, and
  XDG-isolated verification strategy are implemented and tested
- `KILO_CONFIG`, `KILO_CONFIG_DIR`, home-level directory config,
  `KILO_CONFIG_CONTENT`, provider allow/deny, provider whitelist/blacklist, and
  secret-binding blockers can be detected and attributed
- POSIX secret permissions can be repaired without rewriting an unchanged
  secret
- native Windows paths, sandboxing, npm exec behavior, and both Kilo CLI bins
  are proven in CI or a documented native Windows integration run
- docs drift between Kilo website, npm, and source has been accounted for
- product/legal review confirms `@gonkagate/kilo-setup` for public publishing

Already proven or decided in the April 14, 2026 spike:

- `kilo --version` and `kilocode --version` parse as `7.2.0` for the supported
  package
- `kilo debug paths` can be invoked under isolated `HOME` and XDG roots, and
  its global config/data/cache/state paths stay inside the sandbox
- a fake file-backed GonkaGate API key reference under
  `provider.gonkagate.options.apiKey` resolves through `kilo debug config`;
  raw output remains secret-bearing and must not be printed
- a GonkaGate provider with the chosen config shape is listed by
  `kilo models gonkagate`
- the sandboxed Kilo oracle runs with isolated `HOME`, `XDG_CONFIG_HOME`,
  `XDG_DATA_HOME`, `XDG_CACHE_HOME`, and `XDG_STATE_HOME`, and a before/after
  metadata hash showed no unsandboxed user Kilo path changes during a fresh
  sandboxed `7.2.0` path probe
- project-scope docs and UX must state that committed activation requires each
  participating machine to have run the installer or otherwise have a
  compatible user-level `provider.gonkagate` definition
- project-root `kilo.jsonc` or `kilo.json` remain inspected blocker surfaces,
  not write targets, because nested-working-directory discovery is not proven
  for the exact `@kilocode/cli@7.2.0` profile
- `kilocode` remains visible in diagnostics as a fallback command, but
  happy-path copy sends users back to plain `kilo`
- inline `KILO_CONFIG_CONTENT` secret binding remains blocked in production
  even when textually identical to the file-backed binding
- real-path Kilo verification is deliberately not a production default
- Kilo VS Code extension shared settings are supported only through
  CLI-resolved config files; extension-specific behavior is out of scope until
  separately proven

The spike must use fake secrets only and must never paste raw `kilo debug
config` output containing a real secret into logs.

## Production Readiness Acceptance Criteria

Production release is ready when:

- the package validates a supported local Kilo CLI
- interactive setup succeeds for `user` scope
- interactive setup succeeds for `project` scope
- non-interactive setup works with `GONKAGATE_API_KEY`
- non-interactive setup works with `--api-key-stdin`
- plain `--api-key` is rejected
- managed secret is stored under `~/.gonkagate/kilo`
- project config remains secret-free
- project-scope docs and UX state that repository activation still requires a
  per-machine user-level provider definition
- unrelated installer-touched Kilo config is preserved
- real-path Kilo verification is not part of the production default
- Kilo read-time config migrations during sandboxed verification are contained
  within the sandbox
- Kilo-owned state initialization and config-directory dependency-install side
  effects during sandboxed verification do not touch unsandboxed user paths
- native Windows setup passes the same durable local-resolver and sandbox-oracle
  guarantees as POSIX, with a native runner proof that real user, `ProgramData`,
  `AppData`, npm cache, temp, and shell-profile paths are not touched outside
  the declared sandbox and installer-owned targets
- the sandboxed Kilo oracle runs under isolated `HOME`, `XDG_CONFIG_HOME`,
  `XDG_DATA_HOME`, `XDG_CACHE_HOME`, and `XDG_STATE_HOME` roots before invoking
  any Kilo command
- the local resolver matches Kilo's locally inspectable precedence for the
  supported compatibility profiles
- effective durable config is verified through the local resolver, and the
  sandboxed Kilo oracle matches the resolver for the supported compatibility
  profile
- the selected provider shape has passed a live GonkaGate/Kilo
  `chat/completions` compatibility smoke outside the default install success
  path
- the selected model has a proven numeric `limit.output`, or the model is not
  offered as a validated default
- current-session `KILO_CONFIG_CONTENT` blockers are reported
- `KILO_CONFIG` blockers are reported
- `KILO_CONFIG_DIR` blockers are reported
- home-level directory config blockers are reported
- provider allow/deny blockers are reported
- provider whitelist/blacklist blockers are reported
- raw resolved config is never printed
- reruns are idempotent for unchanged setup
- failed durable local-resolver verification rolls back changed
  installer-managed files
- production runtime config omits `limit.input`
- production runtime config does not write `small_model` unless a GonkaGate
  small-model candidate is validated before release
- docs describe Kilo-specific config and verification limits truthfully
- tests cover JSON, JSONC, user scope, project scope, non-interactive input,
  redaction, local precedence resolution, `KILO_CONFIG_DIR`, home-level
  directory blockers, blocker attribution, rollback, and `limit.input`
  omission-or-support behavior

## External Evolution

These are not post-production phases for the setup utility. They require a
changed external contract, an additional audited Kilo compatibility profile, or
new validated GonkaGate model data before they can become production
requirements:

- GonkaGate `/v1/responses`, because GonkaGate currently supports
  `chat/completions` for this installer contract
- a Kilo-native pure config verifier, because `@kilocode/cli@7.2.0` does not
  expose a proven safe pure verifier
- enterprise-aware managed config policies, because production currently blocks
  higher-precedence managed secret bindings rather than treating them as
  supported enterprise ownership
- additional GonkaGate models, because production exposes only curated,
  Kilo-validated model choices
- real-path Kilo verification, because the production verifier strategy is the
  XDG-isolated sandbox oracle
