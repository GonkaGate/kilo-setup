import type { RecommendedProductionDefaultCuratedModel } from "../../src/constants/models.js";
import type { InstallModelCatalog } from "../../src/install/model-catalog.js";

export const TEST_VALIDATED_MODEL = {
  adapterPackage: "@ai-sdk/openai-compatible",
  displayName: "Kimi K2.6",
  key: "kimi-k2.6",
  limits: {
    context: 262144,
    output: 8192,
  },
  modelId: "moonshotai/Kimi-K2.6",
  recommended: true,
  transport: "chat_completions",
  validationStatus: "validated",
} as const satisfies RecommendedProductionDefaultCuratedModel;

export function createValidatedTestModelCatalog(): InstallModelCatalog {
  return {
    getCuratedModelByKey(key) {
      return key === TEST_VALIDATED_MODEL.key
        ? TEST_VALIDATED_MODEL
        : undefined;
    },
    getRecommendedProductionDefaultModel() {
      return TEST_VALIDATED_MODEL;
    },
    getValidatedModels() {
      return [TEST_VALIDATED_MODEL];
    },
  };
}

export function createEmptyTestModelCatalog(): InstallModelCatalog {
  return {
    getCuratedModelByKey() {
      return undefined;
    },
    getRecommendedProductionDefaultModel() {
      return undefined;
    },
    getValidatedModels() {
      return [];
    },
  };
}
