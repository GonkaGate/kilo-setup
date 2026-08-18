# Release Readiness

This document records the current repository-side production-readiness pass for
`@gonkagate/kilo-setup`.

It is an honesty document for the current publishable package shape, not a
claim that every future compatibility question is already closed.

## Contract Alignment Confirmed

The current repository contract is aligned across package metadata, CLI help,
docs, and tests for these facts:

- package name: `@gonkagate/kilo-setup`
- public entrypoint: `npx @gonkagate/kilo-setup`
- binary names: `kilo-setup` and `gonkagate-kilo`
- Kilo command contract: `kilo` first, `kilocode` as fallback
- minimum Kilo compatibility floor: `@kilocode/cli >=7.2.0`
- current GonkaGate transport claim: `chat/completions`
- model availability source: authenticated `GET /v1/models`
- provider catalog exposed to Kilo's OpenCode-style `/models` picker: every
  fetched GonkaGate model id
- model context written per model: live `context_length` from `/v1/models`,
  with a generic `240000` fallback when the gateway does not publish one
- model limit written for Kilo compatibility: `limit.output = 8192` for each
  fetched model entry
- managed secret path: `~/.gonkagate/kilo/api-key`
- project scope stays secret-free and still depends on a compatible
  user-level `provider.gonkagate` definition on each machine
- durable verification uses the local resolver, while the XDG-isolated oracle
  remains a compatibility check with fake secrets

## External Evidence Captured

The current model contract is backed by product direction plus Kilo
compatibility evidence:

- model availability is resolved from GonkaGate `GET /v1/models` after safe
  API-key intake
- the API docs describe the supported request path as
  `POST /v1/chat/completions`
- the package writes `limit.output = 8192` for fetched catalog entries as the
  installer-managed Kilo compatibility clamp because Kilo `7.2.0` requires a
  numeric output limit in custom model config
- the package no longer writes one generic context window for every model: it
  reads each model's `context_length` from `/v1/models` and only falls back to
  `240000` when the response omits it, because Kilo `7.2.0` also requires a
  numeric context limit in custom model config
- npm registry metadata checked on 2026-04-29 showed `@kilocode/cli` patch
  releases in the `7.2.x` line, including `7.2.14`, with both `kilo` and
  `kilocode` binaries still exposed by the wrapper package
- future Kilo releases are not pre-blocked by version; observed compatibility
  breaks should be handled as bugs with targeted fixes

## Explicitly Not Shipped Yet

The repository must continue to avoid these claims:

- no claim that GonkaGate `responses` transport works today
- no claim that real-path Kilo verification is the production default
- no claim that native Windows production support is proven
- no claim that every future Kilo behavior or live GonkaGate model is proven
  beyond fetching and writing the catalog shape

## Remaining Follow-Up Items

These items still benefit from fresh proof or human review outside this
repository-only pass:

- fresh live GonkaGate/Kilo smoke evidence when Kilo's model config
  requirements or transport behavior changes
- native Windows oracle-safety proof on a real runner or equivalent native VM
- product/legal approval for public publishing under
  `@gonkagate/kilo-setup`

Those items do not change the current package contract: the publishable surface
remains the minimum Kilo `7.2.0` floor without an upper version bound,
authenticated GonkaGate `/v1/models` discovery for the chat-completions
catalog, and the current non-Windows verification policy documented above.
