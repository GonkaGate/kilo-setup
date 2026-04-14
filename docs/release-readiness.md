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
- exact compatibility claim: `@kilocode/cli@7.2.0`
- current GonkaGate transport claim: `chat/completions`
- curated public default:
  `qwen/qwen3-235b-a22b-instruct-2507-fp8`
- curated model limits:
  `limit.context = 262144`; no installer-owned `limit.output` clamp is written
- managed secret path: `~/.gonkagate/kilo/api-key`
- project scope stays secret-free and still depends on a compatible
  user-level `provider.gonkagate` definition on each machine
- durable verification uses the local resolver, while the XDG-isolated oracle
  remains a compatibility check with fake secrets

## External Evidence Captured

The current default-model contract is backed by official GonkaGate docs checked
on 2026-04-14:

- the model page lists
  `qwen/qwen3-235b-a22b-instruct-2507-fp8` as available and documents a
  `262K` context window
- the API docs describe the supported request path as `POST /v1/chat/completions`
- the package intentionally does not translate provider-side default
  `max_tokens` guidance into an installer-enforced output cap

## Explicitly Not Shipped Yet

The repository must continue to avoid these claims:

- no support claim for Kilo versions beyond exact `7.2.0`
- no claim that GonkaGate `responses` transport works today
- no claim that real-path Kilo verification is the production default
- no claim that native Windows production support is proven
- no claim that later Kilo patch releases or additional GonkaGate models are
  proven just because the current curated default is shipped

## Remaining Follow-Up Items

These items still benefit from fresh proof or human review outside this
repository-only pass:

- fresh live GonkaGate/Kilo smoke evidence when the selected public model or
  Kilo baseline changes
- native Windows oracle-safety proof on a real runner or equivalent native VM
- product/legal approval for public publishing under
  `@gonkagate/kilo-setup`

Those items do not change the current package contract: the publishable surface
remains the exact Kilo baseline, the single curated default, and the current
non-Windows verification policy documented above.
