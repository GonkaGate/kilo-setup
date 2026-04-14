import assert from "node:assert/strict";
import test from "node:test";
import { writeScopeManagedConfigs } from "../../src/install/scope.js";
import { resolveManagedPaths } from "../../src/install/paths.js";
import type { StubInstallFs } from "./test-deps.js";
import { createStubbedTestInstallDependencies } from "./test-deps.js";

function createScopeTestContext(
  options: {
    seedFiles?: readonly { contents: string; path: string }[];
  } = {},
) {
  const dependencies = createStubbedTestInstallDependencies({
    seedFiles: options.seedFiles,
  });
  const projectRoot = dependencies.runtime.cwd;
  const managedPaths = resolveManagedPaths(
    dependencies.runtime.homeDir,
    projectRoot,
    dependencies.runtime.platform,
  );

  return {
    dependencies,
    fs: dependencies.fs as StubInstallFs,
    managedPaths,
    projectRoot,
  };
}

test("user scope writes provider and activation to user config and removes owned project activation only", async () => {
  const context = createScopeTestContext({
    seedFiles: [
      {
        contents:
          '{\n  "model": "gonkagate/qwen3-235b-a22b-instruct-2507-fp8",\n  "small_model": "custom/small"\n}\n',
        path: "/workspace/project/.kilo/kilo.jsonc",
      },
    ],
  });

  const result = await writeScopeManagedConfigs(
    {
      managedPaths: context.managedPaths,
      model: "qwen3-235b-a22b-instruct-2507-fp8",
      projectRoot: context.projectRoot,
      scope: "user",
    },
    context.dependencies,
  );

  assert.equal(result.userConfig.target, "user_config");
  const userConfigText =
    context.fs.readText("/home/test/.config/kilo/kilo.jsonc") ?? "";
  const projectConfigText =
    context.fs.readText("/workspace/project/.kilo/kilo.jsonc") ?? "";

  assert.match(userConfigText, /"provider"/);
  assert.match(
    userConfigText,
    /"apiKey": "\{file:~\/\.gonkagate\/kilo\/api-key\}"/,
  );
  assert.match(
    userConfigText,
    /"baseURL": "https:\/\/api\.gonkagate\.com\/v1"/,
  );
  assert.match(
    userConfigText,
    /"model": "gonkagate\/qwen3-235b-a22b-instruct-2507-fp8"/,
  );
  assert.doesNotMatch(userConfigText, /small_model/);
  assert.doesNotMatch(projectConfigText, /"model": "gonkagate\//);
  assert.match(projectConfigText, /"small_model": "custom\/small"/);
});

test("project scope writes provider only to user config and activation only to project config", async () => {
  const context = createScopeTestContext();

  const result = await writeScopeManagedConfigs(
    {
      managedPaths: context.managedPaths,
      model: "qwen3-235b-a22b-instruct-2507-fp8",
      projectRoot: context.projectRoot,
      scope: "project",
    },
    context.dependencies,
  );

  assert.equal(result.userConfig.target, "user_config");
  assert.equal(result.projectConfig?.target, "project_config");

  const userConfigText =
    context.fs.readText("/home/test/.config/kilo/kilo.jsonc") ?? "";
  const projectConfigText =
    context.fs.readText("/workspace/project/.kilo/kilo.jsonc") ?? "";

  assert.match(userConfigText, /"provider"/);
  assert.match(projectConfigText, /"model": "gonkagate\//);
  assert.doesNotMatch(projectConfigText, /"provider"/);
  assert.doesNotMatch(projectConfigText, /apiKey/);
  assert.doesNotMatch(projectConfigText, /~\/\.gonkagate\/kilo\/api-key/);
});

test("scope writes are idempotent on rerun", async () => {
  const context = createScopeTestContext();

  const firstWrite = await writeScopeManagedConfigs(
    {
      managedPaths: context.managedPaths,
      model: "qwen3-235b-a22b-instruct-2507-fp8",
      projectRoot: context.projectRoot,
      scope: "project",
    },
    context.dependencies,
  );
  const secondWrite = await writeScopeManagedConfigs(
    {
      managedPaths: context.managedPaths,
      model: "qwen3-235b-a22b-instruct-2507-fp8",
      projectRoot: context.projectRoot,
      scope: "project",
    },
    context.dependencies,
  );

  assert.equal(firstWrite.userConfig.changed, true);
  assert.equal(secondWrite.userConfig.changed, false);
  assert.equal(secondWrite.projectConfig?.changed, false);
});

test("scope switch removes only installer-owned stale activation from the old target", async () => {
  const context = createScopeTestContext({
    seedFiles: [
      {
        contents:
          '{\n  "model": "gonkagate/qwen3-235b-a22b-instruct-2507-fp8",\n  "small_model": "custom/small"\n}\n',
        path: "/home/test/.config/kilo/kilo.jsonc",
      },
      {
        contents: '{\n  "model": "custom/project-model"\n}\n',
        path: "/workspace/project/.kilo/kilo.jsonc",
      },
    ],
  });

  await writeScopeManagedConfigs(
    {
      managedPaths: context.managedPaths,
      model: "qwen3-235b-a22b-instruct-2507-fp8",
      previousManagedModelKey: "qwen3-235b-a22b-instruct-2507-fp8",
      projectRoot: context.projectRoot,
      scope: "project",
    },
    context.dependencies,
  );

  const userConfigText =
    context.fs.readText("/home/test/.config/kilo/kilo.jsonc") ?? "";
  const projectConfigText =
    context.fs.readText("/workspace/project/.kilo/kilo.jsonc") ?? "";

  assert.doesNotMatch(userConfigText, /"model": "gonkagate\//);
  assert.match(userConfigText, /"small_model": "custom\/small"/);
  assert.match(projectConfigText, /"model": "gonkagate\//);
});
