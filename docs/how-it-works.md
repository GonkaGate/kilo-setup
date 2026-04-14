# How It Works

`@gonkagate/kilo-setup` is the shipped onboarding CLI for configuring local
`kilo` to use GonkaGate.

The primary UX is:

```bash
npx @gonkagate/kilo-setup
```

## Current State

The runtime is implemented and shipped.

Today the repository ships:

- the public CLI runtime
- Kilo detection for exact `@kilocode/cli@7.2.0`
- safe secret intake, managed secret persistence, managed Kilo config
  parse/merge/write, rollback, install-state persistence, and redacted result
  rendering
- durable local-resolver verification plus an XDG-isolated `kilo debug config`
  oracle that runs with fake secrets
- docs, contract tests, and CI that describe the shipped runtime truthfully

Current public limit:

- the published contract stays intentionally narrow to exact
  `@kilocode/cli@7.2.0`, `chat/completions`, and non-Windows production claims
- the curated default is
  `qwen/qwen3-235b-a22b-instruct-2507-fp8` with `limit.context = 262144`
  and no installer-owned `limit.output` clamp
- broader model claims still require additional proof before they should be
  added to the public default set

## Install Flow

1. Check that `kilo` is available, or fall back to `kilocode`.
2. Verify the exact supported compatibility profile: `@kilocode/cli@7.2.0`.
3. Resolve the curated model choice and scope.
4. Recommend `project` scope inside a git repository and `user` scope
   otherwise.
5. Accept a GonkaGate API key through:
   - a hidden interactive prompt
   - `GONKAGATE_API_KEY`
   - `--api-key-stdin`
6. Save the secret only under `~/.gonkagate/kilo/api-key`.
7. Write or update the user-level provider definition.
8. When `project` scope is chosen, write only activation settings into
   `.kilo/kilo.jsonc`.
9. On rerun, remove only installer-owned stale GonkaGate activation from the
   old location and preserve unrelated Kilo config.
10. Verify the durable intended Kilo outcome with the local resolver and use
    the XDG-isolated oracle as a compatibility check.
11. If `KILO_CONFIG_CONTENT` is active, or the installer is running inside an
    active `kilo` terminal session with runtime config overrides, verify the
    current session separately.
12. Report redacted blockers or mismatches instead of printing raw resolved
    config.
13. Finish by sending the user back to plain `kilo`.

## Why User-Level Provider Ownership

The product intentionally keeps the provider definition and secret binding in
user scope.

That gives the desired behavior:

- repository-local config stays commit-safe by default
- the secret path never lands in git
- one machine can safely reuse the same user-level provider definition across
  multiple projects
- project activation remains narrow and reversible

Project scope still has one explicit limit: each participating machine needs a
compatible user-level `provider.gonkagate` definition. A repo-local
`.kilo/kilo.jsonc` file alone is not enough on a brand-new machine.

## Verification Truth

Successful writes are not enough on their own. The shipped runtime treats
effective Kilo config as the real success gate.

The durable check uses the local resolver over inspectable Kilo layers such as
user config, project config, `KILO_CONFIG`, `KILO_CONFIG_DIR`, managed config,
and the canonical managed secret binding. After the durable resolver matches,
the runtime runs `kilo debug config` only inside an XDG-isolated sandbox with
fake secret material and compares that oracle output against the intended
contract.

That means:

- real-path Kilo verification is not the production default
- raw `kilo debug config` output stays secret-bearing and must never be shown
- blocker attribution is guaranteed only for locally inspectable layers
- if the sandbox oracle diverges without a local explanation, the runtime
  reports inferred non-local influence rather than claiming success

## Current Product Limits

The repository must stay explicit about what is not yet claimed:

- no support claim beyond exact `@kilocode/cli@7.2.0`
- no GonkaGate `responses` transport claim
- no production-ready native Windows claim before the native oracle-safety
  proof exists
- no implication that later `7.2.x` Kilo builds, broader model catalogs, or
  native Windows are already proven just because the current default is public
