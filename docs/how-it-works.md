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
- Kilo detection for `@kilocode/cli >=7.2.0` without a preset upper bound
- safe secret intake, managed secret persistence, managed Kilo config
  parse/merge/write, rollback, install-state persistence, and redacted result
  rendering
- durable local-resolver verification plus an XDG-isolated `kilo debug config`
  oracle that runs with fake secrets
- docs, contract tests, and CI that describe the shipped runtime truthfully

Current public limit:

- the published contract keeps a minimum Kilo floor of
  `@kilocode/cli >=7.2.0`, `chat/completions`, and non-Windows production
  claims
- model availability comes from authenticated `GET /v1/models` after safe
  API-key intake
- the written provider config includes every fetched GonkaGate
  chat-completions model so Kilo's OpenCode-style `/models` picker can switch
  between the live GonkaGate options
- each fetched model entry gets installer-managed `limit.output = 8192` for
  Kilo `7.2.0` compatibility

## Install Flow

1. Check that `kilo` is available, or fall back to `kilocode`.
2. Verify the minimum accepted Kilo floor: `@kilocode/cli >=7.2.0`.
3. Accept a GonkaGate API key through:
   - a hidden interactive prompt
   - `GONKAGATE_API_KEY`
   - `--api-key-stdin`
4. Fetch the live GonkaGate model catalog from `GET /v1/models`.
5. Resolve the live model choice and scope.
6. Use the recommended scope automatically in the default interactive flow:
   - `project` inside a git repository
   - `user` outside a repository
7. On interactive reruns, ask about scope only when the previous
   installer-managed scope differs from the new recommendation.
8. Save the secret only under `~/.gonkagate/kilo/api-key`.
9. Write or update the user-level provider definition, including the fetched
   GonkaGate model catalog for Kilo's `/models` picker.
10. When `project` scope is chosen, write only activation settings into
    `.kilo/kilo.jsonc`.
11. On rerun, remove only installer-owned stale GonkaGate activation from the
    old location and preserve unrelated Kilo config.
12. Verify the durable intended Kilo outcome with the local resolver and use
    the XDG-isolated oracle as a compatibility check.
13. If `KILO_CONFIG_CONTENT` is active, or the installer is running inside an
    active `kilo` terminal session with runtime config overrides, verify the
    current session separately.
14. For `project` installs, surface Kilo global UI-model cache notices and
    optionally clear the current cached model when the user requests it.
15. Report redacted blockers or mismatches instead of printing raw resolved
    config.
16. Finish by sending the user back to plain `kilo`.

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
contract. Mirrored global config is written into the sandbox XDG config tree so
the oracle sees the same user-level provider layer as the local resolver. That
sandbox is staged in temporary storage outside the repository and cleaned up
after verification.

That means:

- real-path Kilo verification is not the production default
- raw `kilo debug config` output stays secret-bearing and must never be shown
- blocker attribution is guaranteed only for locally inspectable layers
- if the sandbox oracle diverges without a local explanation, the runtime
  reports inferred non-local influence rather than claiming success
- Kilo can still remember the last interactively selected UI model in
  `~/.local/state/kilo/model.json`; that upstream state is not an
  installer-managed config layer and is outside the current verification
  contract

## Current Product Limits

The repository must stay explicit about what is not yet claimed:

- no Kilo version pin beyond the minimum accepted `@kilocode/cli >=7.2.0`
- no GonkaGate `responses` transport claim
- no production-ready native Windows claim before the native oracle-safety
  proof exists
- no implication that every future Kilo behavior, live GonkaGate model, or
  native Windows path is already proven just because the current default is
  public
