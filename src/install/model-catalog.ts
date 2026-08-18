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
  description?: string;
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

/**
 * `GET /v1/models` is the context-window source of truth, but older GonkaGate
 * deployments answer with the bare OpenAI model shape and no `context_length`.
 * This value is only the fallback for those responses; it is never preferred
 * over a live per-model context window.
 *
 * A non-zero fallback is used rather than `0` because the PRD records that Kilo
 * treats `context: 0` as "disable compaction and context-size-dependent usage
 * tracking" (docs/specs/kilo-setup-prd/spec.md). That is degraded behavior, not
 * a hard failure, so this is a quality choice and not a proven hard requirement.
 */
export const FALLBACK_KILO_CONTEXT_LIMIT = 240000;

/**
 * GonkaGate `/v1/models` does not publish a max-output budget, so the
 * installer keeps writing its own Kilo compatibility clamp.
 */
const MANAGED_KILO_OUTPUT_LIMIT = 8192;

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
  const name = readOptionalDisplayString(value.name) ?? id;
  const description = readOptionalDisplayString(value.description);
  const contextLength =
    readOptionalContextLength(value.context_length) ??
    readOptionalContextLength(value.contextLength);

  return {
    adapterPackage: OPENAI_COMPATIBLE_ADAPTER_PACKAGE,
    ...(description === undefined ? {} : { description }),
    displayName: name,
    key: id,
    limits: {
      context: contextLength ?? FALLBACK_KILO_CONTEXT_LIMIT,
      output: MANAGED_KILO_OUTPUT_LIMIT,
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

/**
 * Reads optional catalog display metadata (`name`, `description`).
 *
 * Optional metadata is cosmetic, so a malformed value must never abort an
 * install that would otherwise succeed: anything that is not a usable string
 * is treated as "not published" and the caller falls back. Only `id`, which
 * the installer cannot work without, stays strict.
 *
 * Control characters are stripped because this text is gateway-supplied and is
 * rendered straight into the interactive picker; raw newlines or ANSI escapes
 * would otherwise reflow or recolor the prompt.
 */
function readOptionalDisplayString(value: unknown): string | undefined {
  if (typeof value !== "string") {
    return undefined;
  }

  // eslint-disable-next-line no-control-regex
  const sanitizedValue = value
    .replaceAll(/[\u0000-\u001F\u007F]/gu, " ")
    .trim();

  return sanitizedValue.length === 0 ? undefined : sanitizedValue;
}

/**
 * Returns a usable Kilo context window, or `undefined` when the gateway does
 * not publish one. Absent, `null`, non-positive, and wrong-typed values all
 * mean "unknown" on the wire, so they resolve to `undefined` and let the
 * caller fall back instead of writing `0` or `null` into Kilo config, or
 * failing an install over a context window the installer can substitute.
 */
function readOptionalContextLength(value: unknown): number | undefined {
  if (typeof value !== "number" || !Number.isSafeInteger(value) || value <= 0) {
    return undefined;
  }

  return value;
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
