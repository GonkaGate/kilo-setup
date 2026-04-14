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

test("resolveInstallScope auto-selects the recommended scope in interactive happy paths", async () => {
  const scope = await resolveInstallScope(
    {
      insideGitRepository: true,
      yes: false,
    },
    createStubbedTestInstallDependencies({
      prompts: {
        kind: "override",
        value: {
          readSecret: async () => "gp-test-secret",
          selectOption: async () => {
            throw new Error("scope prompt should not run");
          },
        },
      },
      runtime: {
        stdinIsTTY: true,
        stdoutIsTTY: true,
      },
    }),
  );

  assert.equal(scope, "project");
});

test("resolveInstallScope asks for confirmation when the previous managed scope differs", async () => {
  const promptMessages: string[] = [];

  const scope = await resolveInstallScope(
    {
      insideGitRepository: true,
      previousManagedScope: "user",
      yes: false,
    },
    createStubbedTestInstallDependencies({
      prompts: {
        kind: "override",
        value: {
          readSecret: async () => "gp-test-secret",
          selectOption: async (options) => {
            promptMessages.push(options.message);
            return (
              options.defaultValue ?? options.choices[0]?.value ?? "project"
            );
          },
        },
      },
      runtime: {
        stdinIsTTY: true,
        stdoutIsTTY: true,
      },
    }),
  );

  assert.equal(scope, "project");
  assert.match(
    promptMessages[0] ?? "",
    /The last installer run used "this machine" activation/i,
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
