# Documentation

Start with the repository landing page first:

- [`../README.md`](../README.md): GitHub/npm landing page and fastest user
  onboarding path

Current contract documents:

- [`how-it-works.md`](./how-it-works.md): shipped installer runtime, scope
  model, and verification truth
- [`user-guide.md`](./user-guide.md): practical step-by-step guide for using
  the installer in interactive and non-interactive flows
- [`publishing.md`](./publishing.md): release-please, GitHub Actions, and npm
  trusted-publishing runbook for the scoped public package
- [`security.md`](./security.md): secret-handling, redaction, and managed-file
  safety rules
- [`troubleshooting.md`](./troubleshooting.md): current block conditions,
  scope caveats, and verification policy
- [`release-readiness.md`](./release-readiness.md): current production-
  readiness audit and explicitly unshipped claims
- [`specs/kilo-setup-prd/spec.md`](./specs/kilo-setup-prd/spec.md): copied Kilo
  setup PRD from the planning repository

This repository ships the Kilo installer runtime with a validated curated Qwen
default, no installer-owned `limit.output` clamp, and support claims that stay
pinned to exact `@kilocode/cli@7.2.0`.
