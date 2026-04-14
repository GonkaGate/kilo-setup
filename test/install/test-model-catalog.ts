import type { RecommendedProductionDefaultCuratedModel } from "../../src/constants/models.js";
import type { InstallModelCatalog } from "../../src/install/model-catalog.js";

export const TEST_VALIDATED_MODEL = {
  adapterPackage: "@ai-sdk/openai-compatible",
  displayName: "Qwen3 235B A22B Instruct 2507 FP8",
  key: "qwen3-235b-a22b-instruct-2507-fp8",
  limits: {
    context: 262144,
  },
  modelId: "qwen/qwen3-235b-a22b-instruct-2507-fp8",
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
