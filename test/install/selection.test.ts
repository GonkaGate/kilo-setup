import assert from "node:assert/strict";
import test from "node:test";
import {
  getRecommendedInstallScope,
  resolveInstallModel,
  resolveInstallScope,
} from "../../src/install/selection.js";
import { createStubbedTestInstallDependencies } from "./test-deps.js";
import {
  createEmptyTestModelCatalog,
  createValidatedTestModelCatalog,
} from "./test-model-catalog.js";
import { expectInstallErrorCode } from "./test-helpers.js";

test("resolveInstallModel fails cleanly when no validated models are available", async () => {
  await assert.rejects(
    () =>
      resolveInstallModel(
        {
          yes: true,
        },
        createStubbedTestInstallDependencies({
          models: {
            kind: "override",
            value: createEmptyTestModelCatalog(),
          },
        }),
      ),
    expectInstallErrorCode("validated_models_unavailable"),
  );
});

test("resolveInstallScope recommends project inside a repository and user outside it", () => {
  assert.equal(getRecommendedInstallScope(true), "project");
  assert.equal(getRecommendedInstallScope(false), "user");
});

test("resolveInstallScope requires --scope or --yes in non-interactive mode", async () => {
  await assert.rejects(
    () =>
      resolveInstallScope(
        {
          insideGitRepository: true,
          yes: false,
        },
        createStubbedTestInstallDependencies(),
      ),
    expectInstallErrorCode("scope_selection_required"),
  );
});

test("resolveInstallModel uses the recommended validated default for --yes", async () => {
  const model = await resolveInstallModel(
    {
      yes: true,
    },
    createStubbedTestInstallDependencies({
      models: {
        kind: "override",
        value: createValidatedTestModelCatalog(),
      },
    }),
  );

  assert.equal(model.key, "qwen3-235b-a22b-instruct-2507-fp8");
});
