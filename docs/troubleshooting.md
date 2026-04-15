# Troubleshooting

## The CLI Says No Validated Models Are Available

That is no longer the expected stock public result.

The published package now ships
`qwen/qwen3-235b-a22b-instruct-2507-fp8` as a validated curated default with
installer-managed `limit.output = 8192`.

If you still see `validated_models_unavailable`, you are likely running a
stale build, a locally modified package, or a fork whose curated registry does
not include the published default.

If you see a config error mentioning
`provider.gonkagate.models.qwen3-235b-a22b-instruct-2507-fp8.limit.output`,
you are likely running a stale build that predates the required Kilo 7.2.0
output-limit fix.

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

Inside a git repository, the interactive installer now defaults to `project`
scope automatically. Outside a repository, it defaults to `user`.

## Why Are `KILO_CONFIG`, `KILO_CONFIG_DIR`, And `KILO_CONFIG_CONTENT` Mentioned?

They are real Kilo override layers. The verifier inspects them when it can
attribute blockers, but they are not durable installer targets.

`KILO_CONFIG_CONTENT` is runtime-only. It can block the current shell even
after a durable install has succeeded.

If you run the installer from inside an active `kilo` terminal session,
session-scoped `KILO_CONFIG` or `KILO_CONFIG_DIR` values can also keep that
shell overridden until you exit the session and return to plain `kilo`.

## Why Does `kilo` Still Open On A GonkaGate Model In Another Repository?

First check the resolved Kilo config layer, not only the UI selection. If
`kilo debug config` in that repository resolves `model: null` while the UI
still opens on a GonkaGate model, the installer is not currently activating
GonkaGate there.

On Kilo `7.2.0`, the app can still reuse the last interactively selected model
from `~/.local/state/kilo/model.json`. That file is upstream Kilo state, not
installer-owned config, so project-scope cleanup does not remove it.

If you want a different default outside the repo where project scope was
installed, change the model from inside plain `kilo` in that other repository
or clear the cached selection in `~/.local/state/kilo/model.json`.

The installer can help with the current cached selection by running with
`--clear-kilo-model-cache`, but Kilo may set that cache again after future
interactive model changes.

## Can I Pass `--api-key`?

No. Plain `--api-key` is intentionally rejected so secrets do not land in
shell history or process lists. Safe inputs are hidden prompt,
`GONKAGATE_API_KEY`, and `--api-key-stdin`.

## Does The Installer Use Real-Path `kilo debug config`?

No. The production default uses the local resolver as the durable success gate
and runs `kilo debug config` only inside an XDG-isolated oracle sandbox with
fake secret material. The sandbox mirrors user-level global config into its XDG
config tree so the oracle loads the same provider layer that durable
verification inspected. Current builds create that sandbox in temporary
storage outside the repository and clean it up after verification.

Real-path Kilo verification is not part of the current production contract.

## Why Did Git Show `home/`, `xdg/`, `npm-cache`, Or `workspace/` After Running The Installer?

Those paths are oracle-sandbox staging trees, not intended durable repo files.

Current builds create the oracle sandbox outside the repository and clean it up
after verification, so those directories should not appear in git status.

If you still see them, you are likely running a stale local build. Remove the
stray untracked directories and rerun with an updated package or rebuilt local
checkout.

## What About Native Windows?

The repository does not yet claim production-ready native Windows support.

The current docs and tests keep native Windows behavior scoped to inherited
user-profile ACL expectations until the native oracle-safety proof gate is
closed.
