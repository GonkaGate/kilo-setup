import type {
  EffectiveConfigVerificationBlocker,
  EffectiveConfigVerificationBlockingLayer,
} from "./contracts/effective-config.js";
import {
  getNestedConfigValue,
  getStringArrayConfigValue,
  hasNestedConfigValue,
} from "./config-value.js";
import type { SecretBindingVerificationPolicy } from "./effective-config-policy.js";

interface ManagedOverlapCheck {
  key: string;
  path: readonly string[];
  reason: string;
}

const MANAGED_OVERLAP_CHECKS = Object.freeze([
  {
    key: "provider.gonkagate",
    path: ["provider", "gonkagate"],
    reason:
      "Higher-precedence config overlaps GonkaGate-managed provider settings.",
  },
  {
    key: "model",
    path: ["model"],
    reason:
      "Higher-precedence config overlaps the GonkaGate-managed model selection.",
  },
  {
    key: "small_model",
    path: ["small_model"],
    reason:
      "Higher-precedence config overlaps the GonkaGate-managed small_model selection.",
  },
] as const satisfies readonly ManagedOverlapCheck[]);

const USER_SECRET_BINDING_REASON =
  "User-level Kilo config must own provider.gonkagate.options.apiKey with the canonical {file:~/.gonkagate/kilo/api-key} binding.";
const HIGHER_PRECEDENCE_SECRET_BINDING_REASON =
  "Higher-precedence config must not override the installer-managed GonkaGate secret binding.";
const INLINE_SECRET_BINDING_REASON =
  "KILO_CONFIG_CONTENT must not define provider.gonkagate.options.apiKey during production verification.";

export function collectManagedOverlapBlockers(
  config: Record<string, unknown>,
  layer: EffectiveConfigVerificationBlockingLayer,
  path?: string,
): EffectiveConfigVerificationBlocker[] {
  return MANAGED_OVERLAP_CHECKS.flatMap((check) =>
    hasNestedConfigValue(config, check.path)
      ? [
          {
            key: check.key,
            layer,
            path,
            reason: check.reason,
          },
        ]
      : [],
  );
}

export function collectProviderActivationBlockers(
  config: Record<string, unknown>,
  layer: EffectiveConfigVerificationBlockingLayer,
  providerId: string,
  path?: string,
): EffectiveConfigVerificationBlocker[] {
  const disabledProviders = getStringArrayConfigValue(config, [
    "disabled_providers",
  ]);

  if (disabledProviders?.includes(providerId) === true) {
    return [
      {
        key: "disabled_providers",
        layer,
        path,
        reason: `disabled_providers excludes ${providerId}.`,
      },
    ];
  }

  const enabledProviders = getStringArrayConfigValue(config, [
    "enabled_providers",
  ]);

  if (
    enabledProviders !== undefined &&
    enabledProviders.includes(providerId) === false
  ) {
    return [
      {
        key: "enabled_providers",
        layer,
        path,
        reason: `enabled_providers does not include ${providerId}.`,
      },
    ];
  }

  return [];
}

export function collectProviderModelFilterBlockers(
  config: Record<string, unknown>,
  layer: EffectiveConfigVerificationBlockingLayer,
  options: {
    modelKey: string;
    modelRef: string;
    providerId: string;
  },
  path?: string,
): EffectiveConfigVerificationBlocker[] {
  const whitelist = getStringArrayConfigValue(config, [
    "provider",
    options.providerId,
    "whitelist",
  ]);

  if (
    whitelist !== undefined &&
    whitelist.some((entry) => matchesModelFilterEntry(entry, options)) === false
  ) {
    return [
      {
        key: `provider.${options.providerId}.whitelist`,
        layer,
        path,
        reason: `provider.${options.providerId}.whitelist excludes the selected GonkaGate model.`,
      },
    ];
  }

  const blacklist = getStringArrayConfigValue(config, [
    "provider",
    options.providerId,
    "blacklist",
  ]);

  if (
    blacklist?.some((entry) => matchesModelFilterEntry(entry, options)) === true
  ) {
    return [
      {
        key: `provider.${options.providerId}.blacklist`,
        layer,
        path,
        reason: `provider.${options.providerId}.blacklist excludes the selected GonkaGate model.`,
      },
    ];
  }

  return [];
}

export function collectProviderShapeBlockers(
  config: Record<string, unknown>,
  layer: EffectiveConfigVerificationBlockingLayer,
  providerId: string,
  path?: string,
): EffectiveConfigVerificationBlocker[] {
  const providerValue = getNestedConfigValue(config, ["provider", providerId]);

  if (providerValue === undefined) {
    return [];
  }

  if (
    providerValue === null ||
    typeof providerValue !== "object" ||
    Array.isArray(providerValue)
  ) {
    return [
      {
        key: `provider.${providerId}`,
        layer,
        path,
        reason: `provider.${providerId} must be a JSON object when defined.`,
      },
    ];
  }

  const providerRecord = providerValue as Record<string, unknown>;
  const nestedObjectChecks = [
    {
      key: `provider.${providerId}.models`,
      value: providerRecord.models,
    },
    {
      key: `provider.${providerId}.options`,
      value: providerRecord.options,
    },
  ];

  return nestedObjectChecks.flatMap((check) =>
    check.value === undefined ||
    (check.value !== null &&
      typeof check.value === "object" &&
      !Array.isArray(check.value))
      ? []
      : [
          {
            key: check.key,
            layer,
            path,
            reason: `${check.key} must be a JSON object when defined.`,
          },
        ],
  );
}

export function collectMissingCuratedModelEntryBlockers(
  config: Record<string, unknown>,
  layer: EffectiveConfigVerificationBlockingLayer,
  options: {
    modelKey: string;
    providerId: string;
  },
  path?: string,
): EffectiveConfigVerificationBlocker[] {
  const modelsValue = getNestedConfigValue(config, [
    "provider",
    options.providerId,
    "models",
  ]);

  if (
    modelsValue === undefined ||
    modelsValue === null ||
    typeof modelsValue !== "object" ||
    Array.isArray(modelsValue)
  ) {
    return [];
  }

  const modelValue = (modelsValue as Record<string, unknown>)[options.modelKey];

  if (
    modelValue !== undefined &&
    modelValue !== null &&
    typeof modelValue === "object" &&
    !Array.isArray(modelValue)
  ) {
    return [];
  }

  return [
    {
      key: `provider.${options.providerId}.models.${options.modelKey}`,
      layer,
      path,
      reason:
        "Higher-precedence config defines the GonkaGate provider without the curated model entry.",
    },
  ];
}

export function collectSecretBindingProvenanceBlockers(
  config: Record<string, unknown> | undefined,
  layer: EffectiveConfigVerificationBlockingLayer,
  policy: SecretBindingVerificationPolicy,
  path?: string,
): EffectiveConfigVerificationBlocker[] {
  const secretBindingValue =
    config === undefined
      ? undefined
      : getNestedConfigValue(config, policy.path);

  if (layer === "global_config") {
    return secretBindingValue === policy.canonicalBinding
      ? []
      : [
          {
            key: policy.key,
            layer,
            path,
            reason: USER_SECRET_BINDING_REASON,
          },
        ];
  }

  if (layer === "KILO_CONFIG_CONTENT") {
    return secretBindingValue === undefined
      ? []
      : [
          {
            key: policy.key,
            layer,
            reason: INLINE_SECRET_BINDING_REASON,
          },
        ];
  }

  if (layer === "inferred_non_local") {
    return [];
  }

  return secretBindingValue === undefined
    ? []
    : [
        {
          key: policy.key,
          layer,
          path,
          reason: HIGHER_PRECEDENCE_SECRET_BINDING_REASON,
        },
      ];
}

function matchesModelFilterEntry(
  entry: string,
  options: {
    modelKey: string;
    modelRef: string;
  },
): boolean {
  return entry === options.modelKey || entry === options.modelRef;
}
