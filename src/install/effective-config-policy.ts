import {
  type CuratedModelKey,
  getCuratedModelByKey,
} from "../constants/models.js";
import {
  CURRENT_TRANSPORT_TARGET,
  GONKAGATE_PROVIDER_ID,
} from "../constants/gateway.js";
import type { EffectiveConfigVerificationTarget } from "./contracts/effective-config.js";
import {
  formatKiloModelRef,
  buildManagedProviderConfig,
  GONKAGATE_SECRET_FILE_REFERENCE,
} from "./managed-provider-config.js";
import type { EffectiveConfigValueCheck } from "./verification-mismatches.js";

export interface SecretBindingVerificationPolicy {
  canonicalBinding: string;
  key: string;
  path: readonly string[];
}

export interface ResolvedConfigVerificationPolicy {
  target: EffectiveConfigVerificationTarget;
  valueChecks: readonly EffectiveConfigValueCheck[];
}

const PROVIDER_REASON_RULES = Object.freeze({
  [`provider.${GONKAGATE_PROVIDER_ID}.name`]:
    "Resolved GonkaGate provider name does not match the managed contract.",
  [`provider.${GONKAGATE_PROVIDER_ID}.npm`]:
    "Resolved GonkaGate provider adapter package does not match the managed contract.",
  [`provider.${GONKAGATE_PROVIDER_ID}.options.baseURL`]:
    "Resolved GonkaGate baseURL does not match the canonical v1 endpoint.",
  model: "Resolved model does not match the selected GonkaGate model.",
} as const satisfies Record<string, string>);

export function createResolvedConfigVerificationPolicy(
  modelKey: CuratedModelKey,
): ResolvedConfigVerificationPolicy {
  const model = getCuratedModelByKey(modelKey);

  if (model === undefined) {
    throw new Error(`Unsupported curated model key: ${modelKey}`);
  }

  const target: EffectiveConfigVerificationTarget = {
    modelKey,
    modelRef: formatKiloModelRef(modelKey),
    providerId: GONKAGATE_PROVIDER_ID,
    transport:
      CURRENT_TRANSPORT_TARGET as EffectiveConfigVerificationTarget["transport"],
  };
  const expectedProviderConfig = buildManagedProviderConfig(modelKey);

  return {
    target,
    valueChecks: [
      {
        expected: target.modelRef,
        path: ["model"],
        reason: PROVIDER_REASON_RULES.model,
      },
      ...createObjectValueChecks(
        ["provider", GONKAGATE_PROVIDER_ID],
        expectedProviderConfig,
      ),
    ],
  };
}

export function createSecretBindingVerificationPolicy(
  providerId: string,
): SecretBindingVerificationPolicy {
  const path = ["provider", providerId, "options", "apiKey"] as const;

  return {
    canonicalBinding: GONKAGATE_SECRET_FILE_REFERENCE,
    key: path.join("."),
    path,
  };
}

function createObjectValueChecks(
  path: readonly string[],
  value: unknown,
): EffectiveConfigValueCheck[] {
  if (path.join(".") === `provider.${GONKAGATE_PROVIDER_ID}.options.apiKey`) {
    return [];
  }

  if (value !== null && typeof value === "object" && !Array.isArray(value)) {
    const checks: EffectiveConfigValueCheck[] = [];

    for (const [key, nestedValue] of Object.entries(value)) {
      checks.push(...createObjectValueChecks([...path, key], nestedValue));
    }

    return checks;
  }

  const key = path.join(".");

  return [
    {
      expected: value,
      path,
      reason:
        PROVIDER_REASON_RULES[key as keyof typeof PROVIDER_REASON_RULES] ??
        `Resolved ${key} does not match the managed GonkaGate contract.`,
    },
  ];
}
