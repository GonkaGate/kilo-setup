import assert from "node:assert/strict";
import test from "node:test";
import { GONKAGATE_BASE_URL } from "../../src/constants/gateway.js";
import {
  fetchLiveInstallModelCatalog,
  type InstallHttpClient,
} from "../../src/install/model-catalog.js";
import { expectInstallErrorCode } from "./test-helpers.js";

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
