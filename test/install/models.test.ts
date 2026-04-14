import assert from "node:assert/strict";
import test from "node:test";
import {
  CURATED_MODEL_REGISTRY,
  createCuratedModelIndex,
  getRecommendedProductionDefaultModel,
  getValidatedModelKeys,
} from "../../src/constants/models.js";

test("the default curated model is the shipped validated public default", () => {
  const model = CURATED_MODEL_REGISTRY["qwen3-235b-a22b-instruct-2507-fp8"];

  assert.equal(model.adapterPackage, "@ai-sdk/openai-compatible");
  assert.equal(model.validationStatus, "validated");
  assert.equal(model.limits?.context, 262144);
  assert.equal("output" in (model.limits ?? {}), false);
  assert.deepEqual(getValidatedModelKeys(), [
    "qwen3-235b-a22b-instruct-2507-fp8",
  ]);
  assert.equal(
    getRecommendedProductionDefaultModel()?.key,
    "qwen3-235b-a22b-instruct-2507-fp8",
  );
});

test("createCuratedModelIndex exposes a recommended production default when a validated model is recommended", () => {
  const testRegistry = {
    alpha: {
      adapterPackage: "@ai-sdk/openai-compatible",
      displayName: "Alpha",
      limits: {
        context: 1024,
      },
      modelId: "gonkagate/alpha",
      recommended: false,
      transport: "chat_completions",
      validationStatus: "validated",
    },
    beta: {
      adapterPackage: "@ai-sdk/openai-compatible",
      displayName: "Beta",
      limits: {
        context: 1024,
        output: 2048,
      },
      modelId: "gonkagate/beta",
      recommended: true,
      transport: "chat_completions",
      validationStatus: "validated",
    },
  } as const;

  const index = createCuratedModelIndex(testRegistry);

  assert.deepEqual(index.validatedModelKeys, ["alpha", "beta"]);
  assert.equal(index.recommendedProductionDefaultModel?.key, "beta");
});

test("createCuratedModelIndex rejects more than one recommended validated production default", () => {
  const invalidRegistry = {
    alpha: {
      adapterPackage: "@ai-sdk/openai-compatible",
      displayName: "Alpha",
      limits: {
        output: 512,
      },
      modelId: "gonkagate/alpha",
      recommended: true,
      transport: "chat_completions",
      validationStatus: "validated",
    },
    beta: {
      adapterPackage: "@ai-sdk/openai-compatible",
      displayName: "Beta",
      limits: {
        output: 256,
      },
      modelId: "gonkagate/beta",
      recommended: true,
      transport: "chat_completions",
      validationStatus: "validated",
    },
  } as const;

  assert.throws(
    () => createCuratedModelIndex(invalidRegistry),
    /recommended validated production default/i,
  );
});
