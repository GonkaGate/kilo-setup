# `src/install/`

This directory now contains the shipped Kilo installer runtime.

Start here:

- `index.ts` orchestrates the end-to-end install flow
- `context.ts`, `selection.ts`, and `session.ts` resolve Kilo, workspace,
  validated-model choice, and scope summary
- `deps.ts` keeps command, filesystem, prompt, input, clock, and model-catalog
  seams testable
- `secrets.ts`, `scope.ts`, and `state.ts` own managed secret/config/install-
  state writes
- `managed-provider-config.ts` writes the validated GonkaGate
  chat-completions model catalog into the Kilo/OpenCode-compatible provider
  shape while keeping activation in the top-level `model` setting
- `managed-write-transaction.ts` and `rollback.ts` restore installer-owned
  writes when durable verification fails
- `verify-effective.ts`, `verify-layers.ts`, and related helpers implement the
  durable/current-session Kilo proof path with redacted diagnostics

The current stock runtime ships a validated curated Kimi K2.6 default plus the
validated Qwen3 235B A22B Instruct 2507 FP8 catalog entry. Keep Kilo-specific
behavior here and do not import OpenCode env vars or config targets as runtime
defaults.
