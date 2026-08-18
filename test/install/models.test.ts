import assert from "node:assert/strict";
import test from "node:test";
import { GONKAGATE_BASE_URL } from "../../src/constants/gateway.js";
import {
  FALLBACK_KILO_CONTEXT_LIMIT,
  fetchLiveInstallModelCatalog,
  type InstallHttpClient,
} from "../../src/install/model-catalog.js";
import { expectInstallErrorCode } from "./test-helpers.js";

function createStaticModelsHttp(body: unknown): InstallHttpClient {
  return {
    async fetchJson() {
      return { body, ok: true, status: 200 };
    },
  };
}

test("fetchLiveInstallModelCatalog uses /v1/models as the source of truth", async () => {
  let requestedUrl = "";
  let requestedAuthorization = "";
  const catalog = await fetchLiveInstallModelCatalog("gp-test-secret", {
    async fetchJson(url, options) {
      requestedUrl = url;
      requestedAuthorization = options?.headers?.Authorization ?? "";

      return {
        body: {
          data: [
            { id: "provider/live-alpha", name: "Live Alpha" },
            { id: "provider/live-beta" },
            { id: "provider/live-alpha", name: "Ignored Duplicate" },
          ],
        },
        ok: true,
        status: 200,
      };
    },
  });

  assert.equal(requestedUrl, `${GONKAGATE_BASE_URL}/models`);
  assert.equal(requestedAuthorization, "Bearer gp-test-secret");
  assert.deepEqual(
    catalog.getModels().map((model) => model.key),
    ["provider/live-alpha", "provider/live-beta"],
  );
  assert.equal(
    catalog.getModelByKey("provider/live-alpha")?.displayName,
    "Live Alpha",
  );
  assert.equal(
    catalog.getModelByKey("provider/live-beta")?.displayName,
    "provider/live-beta",
  );
  assert.equal(
    catalog.getRecommendedDefaultModel()?.key,
    "provider/live-alpha",
  );
});

test("fetchLiveInstallModelCatalog reads the live per-model context window", async () => {
  const catalog = await fetchLiveInstallModelCatalog(
    "gp-test-secret",
    createStaticModelsHttp({
      data: [
        {
          context_length: 400000,
          created: 1753920000,
          description: "Fast long-context model.",
          id: "provider/live-long",
          name: "Live Long",
          object: "model",
          owned_by: "gonka",
        },
        {
          context_length: 180000,
          id: "provider/live-short",
          object: "model",
        },
      ],
    }),
  );

  assert.equal(
    catalog.getModelByKey("provider/live-long")?.limits.context,
    400000,
  );
  assert.equal(
    catalog.getModelByKey("provider/live-short")?.limits.context,
    180000,
  );
  assert.equal(
    catalog.getModelByKey("provider/live-long")?.description,
    "Fast long-context model.",
  );
  assert.equal(
    catalog.getModelByKey("provider/live-short")?.description,
    undefined,
  );
  assert.equal(
    catalog.getModelByKey("provider/live-long")?.limits.output,
    8192,
  );
});

test("fetchLiveInstallModelCatalog falls back when a gateway publishes no context window", async () => {
  const catalog = await fetchLiveInstallModelCatalog(
    "gp-test-secret",
    createStaticModelsHttp({
      data: [
        { created: 0, id: "provider/pre-pr70", object: "model" },
        { context_length: null, id: "provider/explicit-null" },
        { context_length: 0, id: "provider/unknown-zero" },
        { context_length: -1, id: "provider/negative" },
        { context_length: 1.5, id: "provider/fractional" },
      ],
    }),
  );

  for (const model of catalog.getModels()) {
    assert.equal(model.limits.context, FALLBACK_KILO_CONTEXT_LIMIT);
    assert.equal(typeof model.limits.context, "number");
  }

  assert.equal(FALLBACK_KILO_CONTEXT_LIMIT, 240000);
});

test("fetchLiveInstallModelCatalog tolerates absent and null optional metadata", async () => {
  const catalog = await fetchLiveInstallModelCatalog(
    "gp-test-secret",
    createStaticModelsHttp({
      data: [
        {
          created: 0,
          description: null,
          id: "provider/bare",
          name: null,
          object: "model",
          owned_by: "gonka",
        },
      ],
    }),
  );
  const model = catalog.getModelByKey("provider/bare");

  assert.equal(model?.displayName, "provider/bare");
  assert.equal(model?.description, undefined);
  assert.equal(model?.limits.context, FALLBACK_KILO_CONTEXT_LIMIT);
  assert.equal(model?.recommended, true);
});

test("fetchLiveInstallModelCatalog also accepts a camelCase context window", async () => {
  const catalog = await fetchLiveInstallModelCatalog(
    "gp-test-secret",
    createStaticModelsHttp({
      data: [{ contextLength: 240001, id: "provider/camel" }],
    }),
  );

  assert.equal(catalog.getModelByKey("provider/camel")?.limits.context, 240001);
});

test("fetchLiveInstallModelCatalog rejects a wrong-typed context window", async () => {
  await assert.rejects(
    () =>
      fetchLiveInstallModelCatalog(
        "gp-test-secret",
        createStaticModelsHttp({
          data: [{ context_length: "400000", id: "provider/string-context" }],
        }),
      ),
    expectInstallErrorCode("validated_models_unavailable"),
  );
});

test("fetchLiveInstallModelCatalog honors an API-provided default model", async () => {
  const catalog = await fetchLiveInstallModelCatalog("gp-test-secret", {
    async fetchJson() {
      return {
        body: {
          data: [
            { id: "provider/live-alpha", name: "Live Alpha" },
            { default: true, id: "provider/live-beta", name: "Live Beta" },
          ],
        },
        ok: true,
        status: 200,
      };
    },
  });

  assert.equal(catalog.getRecommendedDefaultModel()?.key, "provider/live-beta");
});

test("fetchLiveInstallModelCatalog rejects empty or invalid responses", async () => {
  const emptyHttp: InstallHttpClient = {
    async fetchJson() {
      return {
        body: { data: [] },
        ok: true,
        status: 200,
      };
    },
  };
  const invalidHttp: InstallHttpClient = {
    async fetchJson() {
      return {
        body: { data: [{ name: "Missing id" }] },
        ok: true,
        status: 200,
      };
    },
  };

  await assert.rejects(
    () => fetchLiveInstallModelCatalog("gp-test-secret", emptyHttp),
    expectInstallErrorCode("validated_models_unavailable"),
  );
  await assert.rejects(
    () => fetchLiveInstallModelCatalog("gp-test-secret", invalidHttp),
    expectInstallErrorCode("validated_models_unavailable"),
  );
});
