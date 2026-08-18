# `src/install/`

This directory contains the shipped Kilo installer runtime. Start here:

- `index.ts` orchestrates the end-to-end install flow
- `context.ts`, `selection.ts`, and `session.ts` resolve Kilo, workspace,
  live-model choice, and scope summary
- `deps.ts` keeps command, filesystem, HTTP, prompt, input, clock, and
  model-catalog seams testable
- `secrets.ts`, `scope.ts`, and `state.ts` own managed secret/config/install
  state writes
- `managed-provider-config.ts` writes the fetched GonkaGate chat-completions
  model catalog into the Kilo/OpenCode-compatible provider shape while keeping
  activation in the top-level `model` setting
- `managed-write-transaction.ts` and `rollback.ts` restore installer-owned
  writes when durable verification fails
- `verify-effective.ts`, `verify-layers.ts`, and related helpers implement the
  durable/current-session Kilo proof path with redacted diagnostics

The stock runtime fetches `GET https://api.gonkagate.com/v1/models` after safe
API-key intake and uses that live response as the installer model catalog.
`model-catalog.ts` owns that parse: model id, display name, optional
description, and per-model context window all come from the response, and every
field except `id` is treated as possibly absent or `null` so the installer keeps
working against gateways that still answer with the bare OpenAI model shape.
Keep Kilo-specific behavior explicit and do not add OpenCode env vars, config
targets, or runtime defaults.
