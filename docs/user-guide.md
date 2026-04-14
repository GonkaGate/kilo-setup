# User Guide

This guide is the expanded usage reference for `@gonkagate/kilo-setup`.

If you only want the shortest path, run:

```bash
npx @gonkagate/kilo-setup
```

Helpful public links:

- [GonkaGate website](https://gonkagate.com/en)
- [Docs hub](https://gonkagate.com/en/docs)
- [Dashboard / sign up / API key](https://gonkagate.com/en/register)

## What The Utility Does

The installer configures local `kilo` to use GonkaGate without asking the user
to hand-edit Kilo config or store secrets in the repository.

Today the public package is intentionally narrow:

- exact Kilo compatibility target: `@kilocode/cli@7.2.0`
- current transport target: `chat/completions`
- current curated default:
  `qwen/qwen3-235b-a22b-instruct-2507-fp8`
- managed model limits: `limit.context = 262144`, `limit.output = 8192`
- no native Windows production claim yet

## Before You Run It

Make sure these conditions are true:

1. You have local `kilo` installed, or the fallback `kilocode` command is
   available.
2. The local Kilo version matches exact `@kilocode/cli@7.2.0`.
3. You already have a GonkaGate API key from the
   [dashboard](https://gonkagate.com/en/register).
4. You are ready to provide that key through one of the supported safe inputs:
   - hidden interactive prompt
   - `GONKAGATE_API_KEY`
   - `--api-key-stdin`

The installer intentionally rejects plain `--api-key`.

## Interactive Flow

This is the default path for most users:

```bash
npx @gonkagate/kilo-setup
```

The installer will then:

1. Detect `kilo`, or fall back to `kilocode`.
2. Check the exact supported Kilo profile.
3. Offer the curated GonkaGate model choice.
4. Choose the recommended scope automatically:
   - inside a git repository: `project`
   - outside a repository: `user`
5. Prompt for the GonkaGate API key using a hidden input.
6. Write the managed config and verify the result.
7. Return you to normal `kilo` usage.

Interactive reruns ask about scope only when the previous installer-managed
scope differs from the new recommendation.

After it succeeds, go back to your usual CLI:

```bash
kilo
```

## `user` vs `project` Scope

The installer supports two scopes:

- `user`: configure GonkaGate for the current machine
- `project`: activate GonkaGate for the current repository

Recommended rule of thumb:

- inside a git repository, the installer defaults to `project`
- outside a repository, the installer defaults to `user`

Important limit:

`project` scope is commit-safe because it writes only activation settings into
`.kilo/kilo.jsonc`, but each machine still needs a compatible user-level
`provider.gonkagate` definition. In practice, teammates should still run the
installer on their own machines.

## Where Files Are Written

The installer keeps the secret out of the repository by default.

Current managed targets:

- user-level secret: `~/.gonkagate/kilo/api-key`
- user-level durable Kilo config: `~/.config/kilo/kilo.jsonc`
- project-level durable Kilo config: `.kilo/kilo.jsonc`

Current write behavior:

- `user` scope writes provider and activation into user config
- `project` scope writes provider into user config and activation into project
  config
- project scope does not store the raw secret in the repository

## Non-Interactive Flow

Use non-interactive mode when running from scripts, automation, or repeatable
local setup.

When you run non-interactively, pass `--scope` or `--yes`.

If you want the installer to clear Kilo's current global UI-selected model
after setup when possible, add `--clear-kilo-model-cache`.

### Non-interactive setup with stdin

```bash
printf '%s' "$GONKAGATE_API_KEY" | npx @gonkagate/kilo-setup --api-key-stdin --scope project --yes
```

### Non-interactive setup with JSON output

```bash
printf '%s' "$GONKAGATE_API_KEY" | npx @gonkagate/kilo-setup --api-key-stdin --scope project --yes --json
```

### Non-interactive setup with environment input

```bash
GONKAGATE_API_KEY="$GONKAGATE_API_KEY" npx @gonkagate/kilo-setup --scope user --yes
```

Use `--json` when another tool needs a machine-readable result.

## Available CLI Flags

```text
--model <model-key>
--scope <user|project>
--cwd <path>
--api-key-stdin
--clear-kilo-model-cache
--yes
--json
--version
--help
```

What they are for:

- `--model`: choose a curated GonkaGate model key explicitly
- `--scope`: choose `user` or `project` without an interactive prompt
- `--cwd`: change the directory used for project-scope path resolution
- `--api-key-stdin`: read the API key from standard input
- `--clear-kilo-model-cache`: clear Kilo's cached current UI model when the
  installer can reach it safely
- `--yes`: accept recommended defaults where the installer can do so safely
- `--json`: emit machine-readable output

## What Success Looks Like

On success, the installer verifies the intended durable Kilo result instead of
trusting file writes alone.

That means a successful run should leave you able to return to the normal
command:

```bash
kilo
```

If the current shell has runtime-only Kilo overrides such as
`KILO_CONFIG_CONTENT`, or you are running inside an active `kilo` terminal
session that still carries `KILO_CONFIG` or `KILO_CONFIG_DIR`, the installer
may report that the durable install succeeded while the current session is
still blocked.

## Safe Reruns

It is safe to rerun the installer when you need to:

- repeat setup on the same machine
- switch between `user` and `project` scope
- repair managed GonkaGate config after drift
- re-run setup after upgrading or replacing local config

The installer is designed to preserve unrelated Kilo config and remove only
installer-owned stale GonkaGate activation when scope changes.

For `project` installs, the result can also include a notice about Kilo's
global UI model cache in `~/.local/state/kilo/model.json`, because Kilo may
reuse that last selected model in another repository even when the resolved
config there does not activate GonkaGate.

## Common Commands

Show help:

```bash
npx @gonkagate/kilo-setup --help
```

Interactive setup:

```bash
npx @gonkagate/kilo-setup
```

Project setup without prompts:

```bash
printf '%s' "$GONKAGATE_API_KEY" | npx @gonkagate/kilo-setup --api-key-stdin --scope project --yes
```

Project setup with Kilo cache cleanup:

```bash
printf '%s' "$GONKAGATE_API_KEY" | npx @gonkagate/kilo-setup --api-key-stdin --scope project --clear-kilo-model-cache --yes
```

User-level setup without prompts:

```bash
GONKAGATE_API_KEY="$GONKAGATE_API_KEY" npx @gonkagate/kilo-setup --scope user --yes
```

Machine-readable result:

```bash
printf '%s' "$GONKAGATE_API_KEY" | npx @gonkagate/kilo-setup --api-key-stdin --scope project --yes --json
```

## If Setup Is Blocked

The most common reasons are:

- `kilo` and `kilocode` are both missing from `PATH`
- installed Kilo is not exact `@kilocode/cli@7.2.0`
- `KILO_CONFIG`, `KILO_CONFIG_DIR`, or `KILO_CONFIG_CONTENT` overrides are
  changing the effective result
- local provider allow/deny settings still block `gonkagate`

If you need deeper diagnostics, see:

- [`troubleshooting.md`](./troubleshooting.md)
- [`security.md`](./security.md)
- [`how-it-works.md`](./how-it-works.md)
