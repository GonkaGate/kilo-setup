# Security

The shipped runtime resolves secrets only through safe inputs and keeps them in
user-scoped managed storage.

## Secret Rules

Safe secret inputs:

- hidden interactive prompt
- `GONKAGATE_API_KEY`
- `--api-key-stdin`

Not supported:

- plain `--api-key`
- repository-local secret storage
- direct writes to Kilo `auth.json`
- `.env` generation
- shell profile mutation

The canonical managed secret path is `~/.gonkagate/kilo/api-key`.

## Scope Rules

`project` scope must stay commit-safe by default:

- project config contains activation only
- project config must not contain the secret or the secret file path
- the user-level config owns `provider.gonkagate` and the canonical
  `{file:~/.gonkagate/kilo/api-key}` binding
- each participating machine still needs a compatible user-level
  `provider.gonkagate` definition

## Managed File Protection

On POSIX-supported platforms, reruns repair drifted owner-only permissions for
the managed secret file and directory when the contents are unchanged.

On native Windows, managed files stay inside the current user's profile and
rely on inherited per-user ACL behavior. The repository must not claim native
Windows ACL hardening beyond that until it is explicitly implemented and
proven.

## Verification And Redaction Rules

- never print a GonkaGate `gp-...` key
- treat raw `kilo debug config` output as secret-bearing
- redact secret-bearing text on human output, JSON output, and fallback
  entrypoint errors
- use the local resolver as the durable success gate
- use the XDG-isolated `kilo debug config` oracle only as a compatibility check
  with fake secrets
- do not claim real-path Kilo verification as the production default

The current runtime already rejects plain `--api-key`, keeps stock public runs
blocked before writes when no validated curated model exists, and redacts
secret-bearing text on user-facing error paths.
