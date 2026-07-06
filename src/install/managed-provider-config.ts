import {
  GONKAGATE_BASE_URL,
  GONKAGATE_MANAGED_SECRET_PATH,
  GONKAGATE_PROVIDER_ID,
  GONKAGATE_PROVIDER_NAME,
} from "../constants/gateway.js";
import type { JsonObject } from "../json.js";
import type { InstallModel, InstallModelCatalog } from "./model-catalog.js";

export const GONKAGATE_SECRET_FILE_REFERENCE = `{file:${GONKAGATE_MANAGED_SECRET_PATH}}`;

export function formatKiloModelRef(model: InstallModel | string): string {
  const key = typeof model === "string" ? model : model.key;

  return `${GONKAGATE_PROVIDER_ID}/${key}`;
}

export function buildManagedProviderConfig(
  modelKey: string,
  catalog: InstallModelCatalog,
): JsonObject {
  const model = resolveInstallModel(modelKey, catalog);
  const models: JsonObject = {};

  for (const providerModel of createManagedProviderModels(model, catalog)) {
    models[providerModel.key] = createManagedModelConfig(providerModel);
  }

  return {
    models,
    name: GONKAGATE_PROVIDER_NAME,
    npm: model.adapterPackage,
    options: createManagedProviderOptions(),
  };
}

function createManagedProviderModels(
  selectedModel: InstallModel,
  catalog: InstallModelCatalog,
): readonly InstallModel[] {
  const providerModels = catalog
    .getModels()
    .filter(
      (model) =>
        model.transport === selectedModel.transport &&
        model.adapterPackage === selectedModel.adapterPackage,
    );

  if (providerModels.some((model) => model.key === selectedModel.key)) {
    return providerModels;
  }

  throw new Error(
    `Live model catalog does not include selected model: ${selectedModel.key}`,
  );
}

function createManagedModelConfig(model: InstallModel): JsonObject {
  return {
    id: model.modelId,
    limit: {
      context: model.limits.context,
      output: model.limits.output,
    },
    name: model.displayName,
    tool_call: true,
  };
}

function createManagedProviderOptions(): JsonObject {
  return {
    apiKey: GONKAGATE_SECRET_FILE_REFERENCE,
    baseURL: GONKAGATE_BASE_URL,
  };
}

function resolveInstallModel(
  modelKey: string,
  catalog: InstallModelCatalog,
): InstallModel {
  const model = catalog.getModelByKey(modelKey);

  if (model === undefined) {
    throw new Error(`Unsupported GonkaGate model id: ${modelKey}`);
  }

  return model;
}
