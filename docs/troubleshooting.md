# Troubleshooting

## The CLI Says No Validated Models Are Available

That is no longer the expected stock public result.

The published package now ships
`qwen/qwen3-235b-a22b-instruct-2507-fp8` as a validated curated default without
an installer-owned `limit.output` clamp.

If you still see `validated_models_unavailable`, you are likely running a
stale build, a locally modified package, or a fork whose curated registry does
not include the published default.

## The CLI Says Setup Is Blocked

Common reasons:

- `kilo` and `kilocode` are both missing from `PATH`
- `kilo --version` output could not be parsed safely
- local Kilo is present, but it is not exact `@kilocode/cli@7.2.0`
- a higher-precedence Kilo layer such as `KILO_CONFIG`,
  `KILO_CONFIG_DIR`, or `KILO_CONFIG_CONTENT` overrides the intended result
- provider allow/deny settings still disable `gonkagate`

The repository intentionally does not treat `7.2.5` as patch-compatible with
`7.2.0` by implication.

## Why Does Project Scope Still Need Setup On Each Machine?

`project` scope writes only activation settings into `.kilo/kilo.jsonc`.

The provider definition and the canonical
`provider.gonkagate.options.apiKey = {file:~/.gonkagate/kilo/api-key}` binding
remain user-level. That keeps the repository commit-safe, but it also means
each participating machine needs a compatible user-level
`provider.gonkagate` definition before repo-local activation can work.

## Why Are `KILO_CONFIG`, `KILO_CONFIG_DIR`, And `KILO_CONFIG_CONTENT` Mentioned?

They are real Kilo override layers. The verifier inspects them when it can
attribute blockers, but they are not durable installer targets.

`KILO_CONFIG_CONTENT` is runtime-only. It can block the current shell even
after a durable install has succeeded.

## Can I Pass `--api-key`?

No. Plain `--api-key` is intentionally rejected so secrets do not land in
shell history or process lists. Safe inputs are hidden prompt,
`GONKAGATE_API_KEY`, and `--api-key-stdin`.

## Does The Installer Use Real-Path `kilo debug config`?

No. The production default uses the local resolver as the durable success gate
and runs `kilo debug config` only inside an XDG-isolated oracle sandbox with
fake secret material.

Real-path Kilo verification is not part of the current production contract.

## What About Native Windows?

The repository does not yet claim production-ready native Windows support.

The current docs and tests keep native Windows behavior scoped to inherited
user-profile ACL expectations until the native oracle-safety proof gate is
closed.
