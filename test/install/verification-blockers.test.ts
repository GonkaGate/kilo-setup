import assert from "node:assert/strict";
import test from "node:test";
import {
  collectManagedOverlapBlockers,
  collectMissingCuratedModelEntryBlockers,
  collectProviderActivationBlockers,
  collectProviderModelFilterBlockers,
  collectProviderShapeBlockers,
  collectSecretBindingProvenanceBlockers,
} from "../../src/install/verification-blockers.js";
import { createSecretBindingVerificationPolicy } from "../../src/install/effective-config-policy.js";

test("disabled_providers wins over enabled_providers when both mention gonkagate", () => {
  assert.deepEqual(
    collectProviderActivationBlockers(
      {
        disabled_providers: ["gonkagate"],
        enabled_providers: ["gonkagate"],
      },
      "KILO_CONFIG",
      "gonkagate",
      "/tmp/kilo.json",
    ),
    [
      {
        key: "disabled_providers",
        layer: "KILO_CONFIG",
        path: "/tmp/kilo.json",
        reason: "disabled_providers excludes gonkagate.",
      },
    ],
  );
});

test("provider whitelist and blacklist blockers match either the model key or full model ref", () => {
  assert.deepEqual(
    collectProviderModelFilterBlockers(
      {
        provider: {
          gonkagate: {
            blacklist: ["gonkagate/qwen3-235b-a22b-instruct-2507-fp8"],
          },
        },
      },
      "home_directory_config",
      {
        modelKey: "qwen3-235b-a22b-instruct-2507-fp8",
        modelRef: "gonkagate/qwen3-235b-a22b-instruct-2507-fp8",
        providerId: "gonkagate",
      },
      "/home/test/.kilo/kilo.jsonc",
    ),
    [
      {
        key: "provider.gonkagate.blacklist",
        layer: "home_directory_config",
        path: "/home/test/.kilo/kilo.jsonc",
        reason:
          "provider.gonkagate.blacklist excludes the selected GonkaGate model.",
      },
    ],
  );
});

test("provider shape blockers catch non-object provider definitions", () => {
  assert.deepEqual(
    collectProviderShapeBlockers(
      {
        provider: {
          gonkagate: "oops",
        },
      },
      "project_directory_config",
      "gonkagate",
      "/workspace/project/.kilo/kilo.jsonc",
    ),
    [
      {
        key: "provider.gonkagate",
        layer: "project_directory_config",
        path: "/workspace/project/.kilo/kilo.jsonc",
        reason: "provider.gonkagate must be a JSON object when defined.",
      },
    ],
  );
});

test("missing curated model entry blockers fire when a higher-precedence provider omits the selected model", () => {
  assert.deepEqual(
    collectMissingCuratedModelEntryBlockers(
      {
        provider: {
          gonkagate: {
            models: {
              other: {
                id: "other/model",
              },
            },
          },
        },
      },
      "system_managed_config",
      {
        modelKey: "qwen3-235b-a22b-instruct-2507-fp8",
        providerId: "gonkagate",
      },
      "/etc/kilo/kilo.jsonc",
    ),
    [
      {
        key: "provider.gonkagate.models.qwen3-235b-a22b-instruct-2507-fp8",
        layer: "system_managed_config",
        path: "/etc/kilo/kilo.jsonc",
        reason:
          "Higher-precedence config defines the GonkaGate provider without the curated model entry.",
      },
    ],
  );
});

test("secret-binding provenance requires the canonical user binding and forbids higher-precedence overrides", () => {
  const policy = createSecretBindingVerificationPolicy("gonkagate");

  assert.deepEqual(
    collectSecretBindingProvenanceBlockers(
      undefined,
      "global_config",
      policy,
      "/home/test/.config/kilo/kilo.jsonc",
    ),
    [
      {
        key: "provider.gonkagate.options.apiKey",
        layer: "global_config",
        path: "/home/test/.config/kilo/kilo.jsonc",
        reason:
          "User-level Kilo config must own provider.gonkagate.options.apiKey with the canonical {file:~/.gonkagate/kilo/api-key} binding.",
      },
    ],
  );

  assert.deepEqual(
    collectSecretBindingProvenanceBlockers(
      {
        provider: {
          gonkagate: {
            options: {
              apiKey: "{file:/tmp/leak}",
            },
          },
        },
      },
      "KILO_CONFIG_CONTENT",
      policy,
    ),
    [
      {
        key: "provider.gonkagate.options.apiKey",
        layer: "KILO_CONFIG_CONTENT",
        reason:
          "KILO_CONFIG_CONTENT must not define provider.gonkagate.options.apiKey during production verification.",
      },
    ],
  );
});

test("managed overlap blockers flag model and provider overrides", () => {
  assert.deepEqual(
    collectManagedOverlapBlockers(
      {
        model: "custom/model",
        provider: {
          gonkagate: {},
        },
      },
      "project_root_config",
      "/workspace/project/kilo.jsonc",
    ),
    [
      {
        key: "provider.gonkagate",
        layer: "project_root_config",
        path: "/workspace/project/kilo.jsonc",
        reason:
          "Higher-precedence config overlaps GonkaGate-managed provider settings.",
      },
      {
        key: "model",
        layer: "project_root_config",
        path: "/workspace/project/kilo.jsonc",
        reason:
          "Higher-precedence config overlaps the GonkaGate-managed model selection.",
      },
    ],
  );
});
