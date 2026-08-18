import {
  createInstallModelCatalog,
  type InstallModel,
  type InstallModelCatalog,
} from "../../src/install/model-catalog.js";

export const TEST_VALIDATED_MODEL = {
  adapterPackage: "@ai-sdk/openai-compatible",
  displayName: "Live Test Model",
  key: "provider/live-test-model",
  limits: {
    context: 400000,
    output: 8192,
  },
  modelId: "provider/live-test-model",
  recommended: true,
  transport: "chat_completions",
  validationStatus: "validated",
} as const satisfies InstallModel;

export const TEST_EXTRA_MODEL = {
  adapterPackage: "@ai-sdk/openai-compatible",
  displayName: "Live Extra Model",
  key: "provider/live-extra-model",
  limits: {
    context: 180000,
    output: 8192,
  },
  modelId: "provider/live-extra-model",
  recommended: false,
  transport: "chat_completions",
  validationStatus: "validated",
} as const satisfies InstallModel;

/**
 * Second-position fixture shared by the stubbed install dependencies and the
 * effective-config verification tests. Both sides must agree on the whole
 * managed model entry, including its context window, because verification
 * compares the resolved config against the catalog-derived provider block.
 */
export const TEST_SECONDARY_MODEL = {
  adapterPackage: "@ai-sdk/openai-compatible",
  displayName: "Qwen Fixture",
  key: "qwen3-235b-a22b-instruct-2507-fp8",
  limits: {
    context: 240000,
    output: 8192,
  },
  modelId: "qwen3-235b-a22b-instruct-2507-fp8",
  recommended: false,
  transport: "chat_completions",
  validationStatus: "validated",
} as const satisfies InstallModel;

export function createValidatedTestModelCatalog(
  models: readonly InstallModel[] = [TEST_VALIDATED_MODEL],
): InstallModelCatalog {
  return createInstallModelCatalog(models);
}

export function createEmptyTestModelCatalog(): InstallModelCatalog {
  return createInstallModelCatalog([]);
}
