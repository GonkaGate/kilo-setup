# GonkaGate Kilo Setup

Set up local `kilo` to use GonkaGate in one `npx` command.

`@gonkagate/kilo-setup` is for people who already have Kilo installed and want
the shortest safe path to GonkaGate without hand-editing Kilo config, putting
secrets into a repository, or learning Kilo provider internals first.

If you only remember one command, make it this:

```bash
npx @gonkagate/kilo-setup
```

Need context first?

- [GonkaGate website](https://gonkagate.com/en) for the product overview.
- [GonkaGate docs](https://gonkagate.com/en/docs) for API docs, quickstart,
  and reference guides.
- [Dashboard / sign up / get API key](https://gonkagate.com/en/register) if
  you still need a `gp-...` key.

## Why This Exists

This installer configures an existing local `kilo` or `kilocode` install to
use GonkaGate, writes the minimum safe config, verifies the effective result,
and then sends you back to plain `kilo`.

What it does for you:

- keeps the secret out of repo-local config by default
- preserves unrelated Kilo settings instead of replacing whole files
- supports interactive and non-interactive setup
- verifies the intended Kilo result instead of assuming file writes worked
- keeps the public contract narrow and honest

What it does not do:

- it does not install Kilo itself
- it does not claim support beyond exact `@kilocode/cli@7.2.0`
- it does not claim GonkaGate `responses` support today
- it does not claim native Windows production support yet

## Before You Start

You need:

- Node `>=22.14.0`
- local `kilo` installed and available on `PATH`, or the fallback `kilocode`
  command
- local Kilo matching the exact investigated profile: `@kilocode/cli@7.2.0`
- a GonkaGate API key in the usual `gp-...` format from the
  [dashboard](https://gonkagate.com/en/register)

Current public baseline:

- package: `@gonkagate/kilo-setup`
- primary command after setup: `kilo`
- current transport target: `chat/completions`
- curated default:
  `qwen/qwen3-235b-a22b-instruct-2507-fp8`
- installer-managed `limit.output = 8192` for exact `@kilocode/cli@7.2.0`
- no native Windows production claim yet

## Shortest Start Path

### Interactive setup

Use this when you are setting up your own machine:

```bash
npx @gonkagate/kilo-setup
```

The installer will:

1. detect `kilo`, or fall back to `kilocode`
2. verify exact `@kilocode/cli@7.2.0`
3. show the curated model choice
4. choose the recommended scope automatically:
   - inside a git repository: `project`
   - outside a repository: `user`
5. collect your API key through a hidden prompt
6. write the managed config and verify the result
7. return you to normal `kilo` usage

On interactive reruns, the installer asks about scope only if the last
installer-managed scope differs from the new recommendation.

If you launch the installer from inside an active `kilo` terminal session, the
durable install can still succeed while that specific shell remains overridden
by Kilo runtime config until you exit the session and return to plain `kilo`.

### Non-interactive setup

Use this for scripts, automation, or repeatable local setup:

```bash
npx @gonkagate/kilo-setup --scope project --yes
```

Optional Kilo UI-model cache cleanup:

```bash
npx @gonkagate/kilo-setup --scope project --clear-kilo-model-cache --yes
```

With a key from the environment:

```bash
GONKAGATE_API_KEY="$GONKAGATE_API_KEY" npx @gonkagate/kilo-setup --scope user --yes
```

With a key through stdin:

```bash
printf '%s' "$GONKAGATE_API_KEY" | npx @gonkagate/kilo-setup --api-key-stdin --scope project --yes --json
```

If you run non-interactively, pass `--scope` or `--yes`. Inside a git
repository, the recommended default is usually `project`; outside a repo, it
is usually `user`.

## `user` vs `project` Scope

Use `user` when you want GonkaGate available on this machine in general.

- writes the provider definition and activation into user-level Kilo config
- good default outside a repository

Use `project` when you want this repository to activate GonkaGate by default.

- keeps the provider definition and secret binding in user config
- writes only activation settings into `.kilo/kilo.jsonc`
- good default inside a git repository
- the installer also warns when Kilo's global UI model cache could make another
  repository reopen on the last selected GonkaGate model

Important limit:

`project` scope is commit-safe by default, but it is not self-sufficient on a
brand-new machine. Each participating machine still needs a compatible
user-level `provider.gonkagate` definition, usually by running the installer on
that machine too.

## Safe Ways To Pass The API Key

Supported inputs:

- hidden interactive prompt
- `GONKAGATE_API_KEY`
- `--api-key-stdin`

Intentionally not supported:

- plain `--api-key`
- `.env` generation
- shell profile mutation
- repository-local secret storage
- direct writes to Kilo `auth.json`

The installer will never accept plain `--api-key`.

The installer never prints the GonkaGate key.

## Where Files Go

Current managed locations:

- user-level secret: `~/.gonkagate/kilo/api-key`
- durable global config target: `~/.config/kilo/kilo.jsonc`
- durable project config target: `.kilo/kilo.jsonc`

Scope rules:

- `user` scope writes provider and activation into user config
- `project` scope keeps the provider definition in user config and writes only
  activation into project config
- project config stays secret-free by default

## Current Honest Limits

This repository intentionally stays narrow today:

- exact investigated compatibility profile: `@kilocode/cli@7.2.0`
- current transport target: `chat/completions`
- current curated default:
  `qwen/qwen3-235b-a22b-instruct-2507-fp8`
- real-path Kilo verification is not the production default
- native Windows production support is not claimed yet
- later Kilo patch releases, extra models, and new flows are not implied just
  because this package exists

The shipped runtime treats effective Kilo config as the real success gate. It
uses the local resolver as the durable verifier and keeps the XDG-isolated
`kilo debug config` oracle as a compatibility check with fake secrets. Inside
that sandbox, mirrored global Kilo config is written into the sandbox XDG
config tree so Kilo loads the same user-level provider layer the local
resolver inspected. The oracle sandbox is created in temporary storage outside
the repository and is cleaned up after verification, so setup should not leave
`home/`, `xdg/`, `npm-cache`, or mirrored `workspace/` trees in git.

## Need More Detail?

- [User guide](https://github.com/GonkaGate/kilo-setup/blob/main/docs/user-guide.md)
- [How it works](https://github.com/GonkaGate/kilo-setup/blob/main/docs/how-it-works.md)
- [Security notes](https://github.com/GonkaGate/kilo-setup/blob/main/docs/security.md)
- [Troubleshooting](https://github.com/GonkaGate/kilo-setup/blob/main/docs/troubleshooting.md)
- [Release and publishing runbook](https://github.com/GonkaGate/kilo-setup/blob/main/docs/publishing.md)

## Development

```bash
npm install
npm run ci
```

Useful commands:

```bash
npm run build
npm run typecheck
npm test
npm run format:check
npm run package:check
node bin/gonkagate-kilo.js --help
node bin/gonkagate-kilo.js --json
```
