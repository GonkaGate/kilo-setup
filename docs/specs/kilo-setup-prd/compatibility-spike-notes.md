# Kilo Compatibility Spike Notes

Date: April 14, 2026

These notes preserve redacted evidence for the GonkaGate Kilo setup PRD. They do
not contain raw `kilo debug config` output or real secrets.

## Sources Checked

- npm registry via `npm view @kilocode/cli dist-tags version versions --json`
  reported `latest = 7.2.0` and `rc = 7.2.5`.
- npm registry via `npm view @kilocode/cli@7.2.0 bin optionalDependencies --json`
  and `@kilocode/cli@7.2.5` showed both `kilo` and `kilocode` bins pointing to
  `bin/kilo`, with platform optional dependencies.
- npm registry checks for `@gonkagate/kilo-setup` and
  `@gonkagate/kilocode-setup` both returned 404 on April 14, 2026.
- Kilo source tags checked:
  - `v7.2.0`: `760f24608e4bf848771bd38141b15e7141f53772`
  - `v7.2.5`: `ad74e9bf81ca6b459654eb0afad90f567505394e`
- GonkaGate API docs checked:
  - base URL: `https://api.gonkagate.com/v1`
  - generation endpoint: `POST /v1/chat/completions`
  - example model id:
    `qwen/qwen3-235b-a22b-instruct-2507-fp8`
- GonkaGate public model page checked:
  - `qwen/qwen3-235b-a22b-instruct-2507-fp8` context window: `262K`
  - exact output-token limit was not found in a primary GonkaGate source.

## Sandboxed Kilo Commands

All Kilo command probes set these before invoking Kilo:

- `HOME`
- `XDG_CONFIG_HOME`
- `XDG_DATA_HOME`
- `XDG_CACHE_HOME`
- `XDG_STATE_HOME`
- `npm_config_cache`

Representative commands:

```bash
npm exec --yes --package @kilocode/cli@7.2.0 -- kilo --version
npm exec --yes --package @kilocode/cli@7.2.0 -- kilocode --version
npm exec --yes --package @kilocode/cli@7.2.0 -- kilo debug paths
npm exec --yes --package @kilocode/cli@7.2.0 -- kilo debug config
npm exec --yes --package @kilocode/cli@7.2.0 -- kilo models gonkagate --verbose
npm exec --yes --package @kilocode/cli@7.2.0 -- kilo run "Say ok only." \
  --model gonkagate/qwen3-235b-a22b-instruct-2507-fp8 \
  --title spike --auto --format json
```

The `7.2.0` and `7.2.5` wrappers both exposed `kilo` and `kilocode`.
`kilo debug paths` honored the isolated home and XDG roots. A fresh before/after
metadata hash over real user Kilo path candidates was unchanged after a
sandboxed `7.2.0` `kilo debug paths` run.

## Provider Shape Findings

The `7.2.0` source constructs the runtime model URL in this order:

1. model-level `provider.api`
2. provider-level `api`
3. existing model or models.dev API URL

The SDK construction then lets provider-level `options.baseURL` override that
model URL when present.

Runtime probes against a local fake OpenAI-compatible server showed:

- provider-level `api = http://127.0.0.1:<port>/v1` sent one POST to
  `/v1/chat/completions`.
- provider-level `options.baseURL = http://127.0.0.1:<port>/v1` sent one POST
  to `/v1/chat/completions`.
- provider-level `api = http://127.0.0.1:<port>/v1/chat/completions` sent one
  POST to `/v1/chat/completions/chat/completions`.
- the request body model was
  `qwen/qwen3-235b-a22b-instruct-2507-fp8`.
- the Authorization header was present when `options.apiKey` used a fake
  `{file:~/.gonkagate/kilo/api-key}` secret.
- the request was streaming and included tool metadata in the body.

`kilo models gonkagate --verbose` listed the configured provider for these
shapes. When only `options.baseURL` was set, the verbose model `api.url` was
null, but the runtime request still used `options.baseURL` correctly.

## Limits And Small Model

`limit.input` remained present in raw resolved config, but
`kilo models gonkagate --verbose` dropped it for config-defined custom models in
`7.2.0`. The same source gap is visible in `v7.2.5`.

`small_model` is a top-level Kilo setting. Source inspection shows Kilo parses
and resolves it with the normal `provider/model` path, but setting it would
override the user's global/project small-model preference. The spike did not
find a separate validated GonkaGate small model.

## Sandboxed Side Effects

Observed sandbox-contained side effects from `kilo debug paths`, `kilo debug
config`, `kilo models`, and `kilo run` include:

- `data/kilo/kilo.db`, WAL/SHM files, storage migrations, logs, and
  `telemetry-id`
- `cache/kilo/models.json` and `cache/kilo/version`
- cache-level dependency writes under `cache/kilo`
- config-directory dependency writes under `config/kilo`, including
  `package.json`, `.gitignore`, `bun.lock`, and `node_modules`
- `$schema` insertion into the readable global config file
- `permission.bash = "allow"` migration into the highest-precedence existing
  global config file when a global config exists without that field

These side effects reinforce that real-path Kilo verification should not be the
production default.

## Native Windows Decision Spike

Decision: include native Windows in the production-ready support matrix. Keep
WSL as POSIX-supported behavior.

Source-only conclusion: native Windows support appears feasible for exact
`@kilocode/cli@7.2.0`. The remaining blocker is runner-backed proof that the
sandbox oracle and npm invocation do not touch real user, `ProgramData`,
`AppData`, npm cache, temp, or shell-profile paths.

Evidence checked on April 14, 2026:

- npm registry still reported `@kilocode/cli` `latest = 7.2.0` and `rc =
7.2.5`.
- `@kilocode/cli@7.2.0` still exposed both `kilo` and `kilocode` bins through
  `bin/kilo`.
- `@kilocode/cli@7.2.0` still published Windows optional dependency packages
  for `@kilocode/cli-windows-x64`, `@kilocode/cli-windows-x64-baseline`, and
  `@kilocode/cli-windows-arm64`.
- the Windows optional package tarball contained `bin/kilo.exe`; the wrapper
  tarball contained the shared Node `bin/kilo` launcher.
- the shared launcher maps `win32` to package suffix `windows`, chooses
  `kilo.exe`, and probes PowerShell for AVX2 before falling back to the
  baseline package on x64.
- the `v7.2.0` source computes `Global.Path.data`, `cache`, `config`, and
  `state` from `xdg-basedir` at module load with app name `kilo`.
- `xdg-basedir@5.1.0` uses `XDG_DATA_HOME`, `XDG_CACHE_HOME`,
  `XDG_CONFIG_HOME`, and `XDG_STATE_HOME` when set, otherwise falls back to
  `os.homedir()` plus `.local/share`, `.cache`, `.config`, and `.local/state`;
  it does not use Windows `AppData` conventions.
- Kilo's `{file:~/...}` config substitution uses `os.homedir()`, so a Windows
  oracle must set the real home env inputs used by Node, not only
  `KILO_TEST_HOME`.
- Kilo's managed config directory falls back to `%ProgramData%\kilo` on native
  Windows unless `KILO_TEST_MANAGED_CONFIG_DIR` is set.

Native Windows sandbox requirements before production can be claimed:

- run on a real native Windows runner or VM, not only source inspection from
  macOS/Linux;
- set `HOME`, `USERPROFILE`, `HOMEDRIVE`, `HOMEPATH`, all four `XDG_*` home
  variables, `KILO_TEST_MANAGED_CONFIG_DIR`, `KILO_CONFIG`, `KILO_CONFIG_DIR`,
  `KILO_CONFIG_CONTENT`, `KILO_TELEMETRY_LEVEL=off`, `KILO_MACHINE_ID`,
  `KILO_DISABLE_MODELS_FETCH`, `KILO_DISABLE_LSP_DOWNLOAD`,
  `KILO_DISABLE_DEFAULT_PLUGINS`, `KILO_DISABLE_CLAUDE_CODE`,
  `npm_config_cache`, `TMP`, and `TEMP` before invoking Kilo;
- run both `npm exec --yes --package @kilocode/cli@7.2.0 -- kilo ...` and the
  same command with `kilocode`;
- use only fake secret material and never include raw `kilo debug config`
  output in notes;
- diff real user Kilo paths, GonkaGate managed paths, `%ProgramData%\kilo`,
  `%APPDATA%`, `%LOCALAPPDATA%`, npm cache roots, and temp roots before/after
  to prove they were not touched.

Repository follow-up on April 14, 2026:

- phase-3 automation now includes a dedicated `windows-latest` CI proof job
  that runs the sandbox oracle for both `kilo` and `kilocode` with fake secret
  material and fails if real-path candidate snapshots change
- native Windows should still be described as blocked until that job is green
  in CI and the proof output has been reviewed

## Live GonkaGate Smoke

No `GONKAGATE_API_KEY` was present in the environment during the spike. Live
GonkaGate inference was not run.
