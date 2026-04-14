import type { JsonObject, JsonValue } from "../json.js";

export const CURATED_MODEL_TRANSPORTS = Object.freeze([
  "chat_completions",
  "responses",
] as const);

export type CuratedModelTransport = (typeof CURATED_MODEL_TRANSPORTS)[number];
export type CuratedModelValidationStatus = "planned" | "validated";

export type CuratedModelJsonValue = JsonValue;

export interface CuratedModelCompatibility {
  modelHeaders?: Readonly<Record<string, string>>;
  modelOptions?: Readonly<JsonObject>;
  notes?: readonly string[];
  providerOptions?: Readonly<JsonObject>;
}

export interface CuratedModelLimits {
  context?: number;
  output?: number;
}

export interface CuratedModelDefinition {
  adapterPackage: string;
  displayName: string;
  limits?: CuratedModelLimits;
  modelId: string;
  recommended: boolean;
  runtimeCompatibility?: CuratedModelCompatibility;
  transport: CuratedModelTransport;
  validationStatus: CuratedModelValidationStatus;
}

export interface CuratedModelRegistry {
  readonly [key: string]: CuratedModelDefinition;
}

export type CuratedModelRecord<TKey extends string = string> =
  CuratedModelDefinition & {
    key: TKey;
  };

type CuratedModelKeyOf<TRegistry extends CuratedModelRegistry> = Extract<
  keyof TRegistry,
  string
>;
type CuratedModelRecordFor<
  TRegistry extends CuratedModelRegistry,
  TKey extends CuratedModelKeyOf<TRegistry> = CuratedModelKeyOf<TRegistry>,
> = TRegistry[TKey] & {
  key: TKey;
};
type ValidatedCuratedModelRecordFor<
  TRegistry extends CuratedModelRegistry,
  TKey extends CuratedModelKeyOf<TRegistry> = CuratedModelKeyOf<TRegistry>,
> = Extract<
  CuratedModelRecordFor<TRegistry, TKey>,
  { validationStatus: "validated" }
>;
type RecommendedValidatedCuratedModelRecordFor<
  TRegistry extends CuratedModelRegistry,
  TKey extends CuratedModelKeyOf<TRegistry> = CuratedModelKeyOf<TRegistry>,
> = Extract<
  ValidatedCuratedModelRecordFor<TRegistry, TKey>,
  { recommended: true }
>;

export interface CuratedModelIndex<
  TRegistry extends CuratedModelRegistry = CuratedModelRegistry,
> {
  modelKeys: readonly CuratedModelKeyOf<TRegistry>[];
  models: readonly CuratedModelRecordFor<TRegistry>[];
  recommendedProductionDefaultModel:
    | RecommendedValidatedCuratedModelRecordFor<TRegistry>
    | undefined;
  validatedModelKeys: readonly ValidatedCuratedModelRecordFor<TRegistry>["key"][];
  validatedModels: readonly ValidatedCuratedModelRecordFor<TRegistry>[];
}

export const CURATED_MODEL_REGISTRY = Object.freeze({
  "qwen3-235b-a22b-instruct-2507-fp8": {
    adapterPackage: "@ai-sdk/openai-compatible",
    displayName: "Qwen3 235B A22B Instruct 2507 FP8",
    limits: {
      context: 262144,
      output: 8192,
    },
    modelId: "qwen/qwen3-235b-a22b-instruct-2507-fp8",
    recommended: true,
    runtimeCompatibility: {
      notes: [
        "Official GonkaGate model metadata lists this model as available with a 262K context window.",
        "Official GonkaGate OpenClaw provider guidance lists this model with maxTokens 8192.",
        "Kilo 7.2.0 rejects custom model entries without a numeric limit.output value, so the installer writes limit.output = 8192 for this validated default.",
      ],
    },
    transport: "chat_completions",
    validationStatus: "validated",
  },
} as const satisfies CuratedModelRegistry);

function toCuratedModelRecord<
  TKey extends string,
  TDefinition extends CuratedModelDefinition,
>(key: TKey, definition: TDefinition): TDefinition & { key: TKey } {
  return {
    ...definition,
    key,
  };
}

export function isValidatedModel<
  TModel extends { validationStatus: CuratedModelValidationStatus },
>(model: TModel): model is Extract<TModel, { validationStatus: "validated" }> {
  return model.validationStatus === "validated";
}

export function isRecommendedModel<TModel extends { recommended: boolean }>(
  model: TModel,
): model is Extract<TModel, { recommended: true }> {
  return model.recommended;
}

export function createCuratedModelIndex<TRegistry extends CuratedModelRegistry>(
  registry: TRegistry,
): CuratedModelIndex<TRegistry> {
  type RegistryKey = CuratedModelKeyOf<TRegistry>;
  type RegistryModel = CuratedModelRecordFor<TRegistry>;
  type ValidatedRegistryModel = ValidatedCuratedModelRecordFor<TRegistry>;
  type RecommendedValidatedRegistryModel =
    RecommendedValidatedCuratedModelRecordFor<TRegistry>;

  const modelKeys = Object.keys(registry) as RegistryKey[];
  const models: RegistryModel[] = [];
  const validatedModels: ValidatedRegistryModel[] = [];
  const validatedModelKeys: ValidatedRegistryModel["key"][] = [];
  const recommendedProductionDefaultModels: RecommendedValidatedRegistryModel[] =
    [];

  for (const key of modelKeys) {
    const model = toCuratedModelRecord(key, registry[key]);
    models.push(model);

    if (!isValidatedModel(model)) {
      continue;
    }

    validatedModels.push(model);
    validatedModelKeys.push(model.key);

    if (isRecommendedModel(model)) {
      recommendedProductionDefaultModels.push(model);
    }
  }

  if (recommendedProductionDefaultModels.length > 1) {
    throw new Error(
      "Curated model registry must not expose more than one recommended validated production default.",
    );
  }

  return {
    modelKeys: Object.freeze(modelKeys),
    models: Object.freeze(models),
    recommendedProductionDefaultModel: recommendedProductionDefaultModels[0],
    validatedModelKeys: Object.freeze(validatedModelKeys),
    validatedModels: Object.freeze(validatedModels),
  };
}

type DefaultCuratedModelRegistry = typeof CURATED_MODEL_REGISTRY;

export type CuratedModelKey = CuratedModelKeyOf<DefaultCuratedModelRegistry>;
export type CuratedModel = CuratedModelDefinition & { key: CuratedModelKey };
export type CuratedModelByKey<TKey extends CuratedModelKey> =
  CuratedModelRecordFor<DefaultCuratedModelRegistry, TKey>;
export type ValidatedCuratedModel = CuratedModelDefinition & {
  key: CuratedModelKey;
  validationStatus: "validated";
};
export type RecommendedProductionDefaultCuratedModel = ValidatedCuratedModel & {
  recommended: true;
};

const DEFAULT_CURATED_MODEL_INDEX = createCuratedModelIndex(
  CURATED_MODEL_REGISTRY,
);

export const SUPPORTED_MODELS: readonly CuratedModel[] =
  DEFAULT_CURATED_MODEL_INDEX.models;

export const SUPPORTED_MODEL_KEYS: readonly CuratedModelKey[] =
  DEFAULT_CURATED_MODEL_INDEX.modelKeys;

export function isCuratedModelKey(key: string): key is CuratedModelKey {
  return key in CURATED_MODEL_REGISTRY;
}

export function isCuratedModelTransport(
  value: unknown,
): value is CuratedModelTransport {
  return (
    typeof value === "string" &&
    CURATED_MODEL_TRANSPORTS.includes(value as CuratedModelTransport)
  );
}

export function getCuratedModelByKey<TKey extends CuratedModelKey>(
  key: TKey,
): CuratedModelByKey<TKey>;
export function getCuratedModelByKey(key: string): CuratedModel | undefined;
export function getCuratedModelByKey(key: string): CuratedModel | undefined {
  if (!isCuratedModelKey(key)) {
    return undefined;
  }

  return toCuratedModelRecord(key, CURATED_MODEL_REGISTRY[key]);
}

export function getValidatedModels(): readonly ValidatedCuratedModel[] {
  return DEFAULT_CURATED_MODEL_INDEX.validatedModels as readonly ValidatedCuratedModel[];
}

export function getValidatedModelKeys(): readonly ValidatedCuratedModel["key"][] {
  return DEFAULT_CURATED_MODEL_INDEX.validatedModelKeys as readonly ValidatedCuratedModel["key"][];
}

export function getRecommendedProductionDefaultModel():
  | RecommendedProductionDefaultCuratedModel
  | undefined {
  return DEFAULT_CURATED_MODEL_INDEX.recommendedProductionDefaultModel as
    | RecommendedProductionDefaultCuratedModel
    | undefined;
}
