import assert from "node:assert/strict";
import test from "node:test";
import { resolveManagedPaths } from "../../src/install/paths.js";
import {
  resolveCurrentSessionLocalKiloConfig,
  resolveDurableLocalKiloConfig,
  selectHighestPrecedenceInspectableBlockers,
} from "../../src/install/verify-layers.js";
import { createStubbedTestInstallDependencies } from "./test-deps.js";

function createVerificationRequest(
  overrides: {
    cwd?: string;
    homeDir?: string;
    platform?: NodeJS.Platform;
    projectRoot?: string;
  } = {},
) {
  const homeDir = overrides.homeDir ?? "/home/test";
  const projectRoot = overrides.projectRoot ?? "/workspace/project";
  const platform = overrides.platform ?? "linux";

  return {
    managedPaths: resolveManagedPaths(homeDir, projectRoot, platform),
    model: "qwen3-235b-a22b-instruct-2507-fp8" as const,
    projectRoot,
    providerId: "gonkagate",
    scope: "project" as const,
  };
}

test("durable resolver excludes KILO_CONFIG_CONTENT while current-session resolver includes it", async () => {
  const dependencies = createStubbedTestInstallDependencies({
    runtime: {
      cwd: "/workspace/project",
      env: {
        KILO_CONFIG_CONTENT: '{ "model": "inline/model" }',
      },
    },
    seedFiles: [
      {
        contents: '{ "model": "config-dir/model" }\n',
        path: "/home/test/.kilo/kilo.jsonc",
      },
    ],
  });
  const request = createVerificationRequest();

  const durable = await resolveDurableLocalKiloConfig(request, dependencies);
  const currentSession = await resolveCurrentSessionLocalKiloConfig(
    request,
    dependencies,
  );

  assert.equal(durable.resolvedConfig.model, "config-dir/model");
  assert.equal(currentSession.resolvedConfig.model, "inline/model");
  assert.equal(
    currentSession.layers.some(
      (layer) => layer.source.layer === "KILO_CONFIG_CONTENT",
    ),
    true,
  );
  assert.equal(
    durable.layers.some(
      (layer) => layer.source.layer === "KILO_CONFIG_CONTENT",
    ),
    false,
  );
});

test("resolver respects inspectable layer precedence across file-backed sources", async () => {
  const dependencies = createStubbedTestInstallDependencies({
    runtime: {
      cwd: "/workspace/project",
      env: {
        KILO_CONFIG: "/workspace/overrides/kilo.json",
        KILO_CONFIG_DIR: "/workspace/config-dir",
      },
    },
    seedFiles: [
      {
        contents: '{ "model": "global/model" }\n',
        path: "/home/test/.config/kilo/kilo.jsonc",
      },
      {
        contents: '{ "model": "env/model" }\n',
        path: "/workspace/overrides/kilo.json",
      },
      {
        contents: '{ "model": "project-root/model" }\n',
        path: "/workspace/project/kilo.jsonc",
      },
      {
        contents: '{ "model": "project-dir/model" }\n',
        path: "/workspace/project/.kilo/kilo.jsonc",
      },
      {
        contents: '{ "model": "home-dir/model" }\n',
        path: "/home/test/.kilo/kilo.jsonc",
      },
      {
        contents: '{ "model": "config-dir/model" }\n',
        path: "/workspace/config-dir/kilo.jsonc",
      },
      {
        contents: '{ "model": "system/model" }\n',
        path: "/etc/kilo/kilo.jsonc",
      },
    ],
  });
  const request = createVerificationRequest();

  const resolution = await resolveDurableLocalKiloConfig(request, dependencies);

  assert.equal(resolution.resolvedConfig.model, "system/model");
  assert.deepEqual(
    resolution.layers.map((layer) => layer.source.layer),
    [
      "global_config",
      "KILO_CONFIG",
      "project_root_config",
      "project_directory_config",
      "home_directory_config",
      "KILO_CONFIG_DIR",
      "system_managed_config",
    ],
  );
});

test("resolver scans project-tree directory configs from root to nested cwd", async () => {
  const dependencies = createStubbedTestInstallDependencies({
    runtime: {
      cwd: "/workspace/project/packages/app",
    },
    seedFiles: [
      {
        contents: '{ "model": "root/project" }\n',
        path: "/workspace/project/.kilo/kilo.jsonc",
      },
      {
        contents: '{ "model": "nested/project" }\n',
        path: "/workspace/project/packages/app/.opencode/opencode.json",
      },
    ],
  });
  const request = createVerificationRequest({
    cwd: "/workspace/project/packages/app",
    projectRoot: "/workspace/project",
  });

  const resolution = await resolveDurableLocalKiloConfig(request, dependencies);

  assert.equal(resolution.resolvedConfig.model, "nested/project");
});

test("highest-precedence blocker selection keeps the winning inspectable layer per key", () => {
  assert.deepEqual(
    selectHighestPrecedenceInspectableBlockers([
      {
        key: "model",
        layer: "global_config",
        reason: "global",
      },
      {
        key: "model",
        layer: "KILO_CONFIG_DIR",
        reason: "config-dir",
      },
      {
        key: "model",
        layer: "project_root_config",
        reason: "project-root",
      },
    ]),
    [
      {
        key: "model",
        layer: "KILO_CONFIG_DIR",
        reason: "config-dir",
      },
    ],
  );
});
