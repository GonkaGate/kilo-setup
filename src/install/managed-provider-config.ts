import {
  GONKAGATE_BASE_URL,
  GONKAGATE_MANAGED_SECRET_PATH,
  GONKAGATE_PROVIDER_ID,
  GONKAGATE_PROVIDER_NAME,
} from "../constants/gateway.js";
import {
  getCuratedModelByKey,
  getValidatedModels,
  type CuratedModel,
  type CuratedModelCompatibility,
  type CuratedModelKey,
  type CuratedModelLimits,
  type ValidatedCuratedModel,
} from "../constants/models.js";
import type { JsonObject } from "../json.js";

export const GONKAGATE_SECRET_FILE_REFERENCE = `{file:${GONKAGATE_MANAGED_SECRET_PATH}}`;

export function formatKiloModelRef(
  model: CuratedModel | CuratedModelKey,
): string {
  const key = typeof model === "string" ? model : model.key;

  return `${GONKAGATE_PROVIDER_ID}/${key}`;
}

export function buildManagedProviderConfig(
  modelKey: CuratedModelKey,
): JsonObject {
  const model = resolveCuratedModel(modelKey);
  const providerModels = createManagedProviderModels(model);
  const models: JsonObject = {};

  for (const providerModel of providerModels) {
    models[providerModel.key] = createManagedModelConfig(providerModel);
  }

  return {
    models,
    name: GONKAGATE_PROVIDER_NAME,
    npm: model.adapterPackage,
    options: createManagedProviderOptions(model),
  };
}

function createManagedProviderModels(
  selectedModel: CuratedModel,
): readonly ValidatedCuratedModel[] {
  const providerModels = getValidatedModels().filter(
    (model) =>
      model.transport === selectedModel.transport &&
      model.adapterPackage === selectedModel.adapterPackage,
  );

  if (providerModels.some((model) => model.key === selectedModel.key)) {
    return providerModels;
  }

  throw new Error(
    `Validated model catalog does not include selected model: ${selectedModel.key}`,
  );
}

function createManagedModelConfig(model: ValidatedCuratedModel): JsonObject {
  const runtimeCompatibility = model.runtimeCompatibility as
    | CuratedModelCompatibility
    | undefined;
  const limits = model.limits as CuratedModelLimits | undefined;
  const modelConfig: JsonObject = {
    id: model.modelId,
    name: model.displayName,
    tool_call: true,
  };

  if (
    typeof limits?.context === "number" ||
    typeof limits?.output === "number"
  ) {
    const limit: JsonObject = {};

    if (typeof limits?.context === "number") {
      limit.context = limits.context;
    }

    if (typeof limits?.output === "number") {
      limit.output = limits.output;
    }

    modelConfig.limit = limit;
  }

  const modelOptions = runtimeCompatibility?.modelOptions;

  if (modelOptions !== undefined) {
    Object.assign(modelConfig, modelOptions);
  }

  return modelConfig;
}

function createManagedProviderOptions(model: CuratedModel): JsonObject {
  const runtimeCompatibility = model.runtimeCompatibility as
    | CuratedModelCompatibility
    | undefined;
  const providerOptions: JsonObject = {
    apiKey: GONKAGATE_SECRET_FILE_REFERENCE,
    baseURL: GONKAGATE_BASE_URL,
  };

  if (runtimeCompatibility?.providerOptions !== undefined) {
    Object.assign(providerOptions, runtimeCompatibility.providerOptions);
  }

  return providerOptions;
}

function resolveCuratedModel(modelKey: CuratedModelKey): CuratedModel {
  const model = getCuratedModelByKey(modelKey);

  if (model === undefined) {
    throw new Error(`Unsupported curated model key: ${modelKey}`);
  }

  if (model.validationStatus !== "validated") {
    throw new Error(`Unvalidated curated model key: ${modelKey}`);
  }

  return model;
}
