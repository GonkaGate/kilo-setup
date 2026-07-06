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
    context: 240000,
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
    context: 240000,
    output: 8192,
  },
  modelId: "provider/live-extra-model",
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
