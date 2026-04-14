import {
  GONKAGATE_BASE_URL,
  GONKAGATE_MANAGED_SECRET_PATH,
  GONKAGATE_PROVIDER_ID,
  GONKAGATE_PROVIDER_NAME,
} from "../constants/gateway.js";
import {
  getCuratedModelByKey,
  type CuratedModel,
  type CuratedModelCompatibility,
  type CuratedModelKey,
  type CuratedModelLimits,
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

  const providerOptions: JsonObject = {
    apiKey: GONKAGATE_SECRET_FILE_REFERENCE,
    baseURL: GONKAGATE_BASE_URL,
  };

  if (runtimeCompatibility?.providerOptions !== undefined) {
    Object.assign(providerOptions, runtimeCompatibility.providerOptions);
  }

  return {
    models: {
      [model.key]: modelConfig,
    },
    name: GONKAGATE_PROVIDER_NAME,
    npm: model.adapterPackage,
    options: providerOptions,
  };
}

function resolveCuratedModel(modelKey: CuratedModelKey): CuratedModel {
  const model = getCuratedModelByKey(modelKey);

  if (model === undefined) {
    throw new Error(`Unsupported curated model key: ${modelKey}`);
  }

  return model;
}
