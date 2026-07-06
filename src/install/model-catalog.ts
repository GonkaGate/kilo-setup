import { CURRENT_TRANSPORT, GONKAGATE_BASE_URL } from "../constants/gateway.js";
import { createInstallError } from "./errors.js";

export type InstallModelTransport = typeof CURRENT_TRANSPORT;
export type InstallModelKey = string;

export interface InstallModelLimits {
  context: number;
  output: number;
}

export interface InstallModel {
  adapterPackage: string;
  displayName: string;
  key: InstallModelKey;
  limits: InstallModelLimits;
  modelId: string;
  recommended: boolean;
  transport: InstallModelTransport;
  validationStatus: "validated";
}

export interface InstallModelCatalog {
  getModelByKey(key: string): InstallModel | undefined;
  getModels(): readonly InstallModel[];
  getRecommendedDefaultModel(): InstallModel | undefined;
}

export interface InstallHttpJsonResponse {
  body: unknown;
  ok: boolean;
  status: number;
}

export interface InstallHttpClient {
  fetchJson(
    url: string,
    options?: {
      headers?: Readonly<Record<string, string>>;
      method?: "GET";
    },
  ): Promise<InstallHttpJsonResponse>;
}

const GONKAGATE_MODELS_URL = `${GONKAGATE_BASE_URL}/models`;
const OPENAI_COMPATIBLE_ADAPTER_PACKAGE = "@ai-sdk/openai-compatible";
const GENERIC_KILO_CONTEXT_LIMIT = 240000;
const GENERIC_KILO_OUTPUT_LIMIT = 8192;

export async function fetchLiveInstallModelCatalog(
  apiKey: string,
  http: InstallHttpClient,
): Promise<InstallModelCatalog> {
  let response: InstallHttpJsonResponse;

  try {
    response = await http.fetchJson(GONKAGATE_MODELS_URL, {
      headers: {
        Accept: "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      method: "GET",
    });
  } catch {
    throw createInstallError("validated_models_unavailable", {});
  }

  if (!response.ok) {
    throw createInstallError("validated_models_unavailable", {});
  }

  return createInstallModelCatalog(parseLiveModelsResponse(response.body));
}

export function createInstallModelCatalog(
  models: readonly InstallModel[],
): InstallModelCatalog {
  const modelsByKey = new Map(models.map((model) => [model.key, model]));
  const recommendedModel = models.find((model) => model.recommended);

  return {
    getModelByKey(key) {
      return modelsByKey.get(key);
    },
    getModels() {
      return models;
    },
    getRecommendedDefaultModel() {
      return recommendedModel;
    },
  };
}

export function createDefaultInstallModelCatalog(): InstallModelCatalog {
  return createInstallModelCatalog([]);
}

function parseLiveModelsResponse(value: unknown): readonly InstallModel[] {
  if (!isObjectRecord(value) || !Array.isArray(value.data)) {
    throw createInstallError("validated_models_unavailable", {});
  }

  const seenIds = new Set<string>();
  const models: InstallModel[] = [];
  let responseDefaultId: string | undefined;

  for (const entry of value.data) {
    const parsedModel = parseLiveModel(entry);

    if (seenIds.has(parsedModel.key)) {
      continue;
    }

    seenIds.add(parsedModel.key);
    models.push(parsedModel);

    if (responseDefaultId === undefined && isResponseDefaultModel(entry)) {
      responseDefaultId = parsedModel.key;
    }
  }

  if (models.length === 0) {
    throw createInstallError("validated_models_unavailable", {});
  }

  const defaultModelId = responseDefaultId ?? models[0]?.key;

  return Object.freeze(
    models.map((model) => ({
      ...model,
      recommended: model.key === defaultModelId,
    })),
  );
}

function parseLiveModel(value: unknown): InstallModel {
  if (!isObjectRecord(value)) {
    throw createInstallError("validated_models_unavailable", {});
  }

  const id = parseRequiredNonEmptyString(value.id);
  const name = parseOptionalNonEmptyString(value.name) ?? id;

  return {
    adapterPackage: OPENAI_COMPATIBLE_ADAPTER_PACKAGE,
    displayName: name,
    key: id,
    limits: {
      context: GENERIC_KILO_CONTEXT_LIMIT,
      output: GENERIC_KILO_OUTPUT_LIMIT,
    },
    modelId: id,
    recommended: false,
    transport: CURRENT_TRANSPORT,
    validationStatus: "validated",
  };
}

function parseRequiredNonEmptyString(value: unknown): string {
  if (typeof value !== "string") {
    throw createInstallError("validated_models_unavailable", {});
  }

  const trimmedValue = value.trim();

  if (trimmedValue.length === 0) {
    throw createInstallError("validated_models_unavailable", {});
  }

  return trimmedValue;
}

function parseOptionalNonEmptyString(value: unknown): string | undefined {
  if (value === undefined) {
    return undefined;
  }

  if (typeof value !== "string") {
    throw createInstallError("validated_models_unavailable", {});
  }

  const trimmedValue = value.trim();

  return trimmedValue.length === 0 ? undefined : trimmedValue;
}

function isResponseDefaultModel(value: unknown): boolean {
  return isObjectRecord(value) && value.default === true;
}

export function isInstallModelTransport(
  value: unknown,
): value is InstallModelTransport {
  return value === CURRENT_TRANSPORT;
}

function isObjectRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
