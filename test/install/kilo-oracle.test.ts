import assert from "node:assert/strict";
import test from "node:test";
import { createKiloOracleInvocation } from "../../src/install/kilo-oracle.js";
import { resolveManagedPaths } from "../../src/install/paths.js";
import {
  createStubbedTestInstallDependencies,
  type StubInstallFs,
} from "./test-deps.js";

test("createKiloOracleInvocation builds an isolated sandbox environment and mirrors fake secret storage", async () => {
  const dependencies = createStubbedTestInstallDependencies({
    runtime: {
      cwd: "/workspace/project",
      env: {
        KILO_CONFIG: "/workspace/overrides/kilo.json",
        KILO_CONFIG_DIR: "/workspace/config-dir",
      },
      platform: "linux",
    },
    seedFiles: [
      {
        contents: '{ "model": "env/model" }\n',
        path: "/workspace/overrides/kilo.json",
      },
      {
        contents: '{ "model": "dir/model" }\n',
        path: "/workspace/config-dir/kilo.jsonc",
      },
      {
        contents: '{ "model": "project/model" }\n',
        path: "/workspace/project/.kilo/kilo.jsonc",
      },
    ],
  });
  const managedPaths = resolveManagedPaths(
    dependencies.runtime.homeDir,
    dependencies.runtime.cwd,
    dependencies.runtime.platform,
  );
  const fs = dependencies.fs as StubInstallFs;

  const invocation = await createKiloOracleInvocation(
    {
      commandName: "kilo",
      layers: [
        {
          config: {
            model: "env/model",
          },
          source: {
            kind: "file",
            layer: "KILO_CONFIG",
            path: "/workspace/overrides/kilo.json",
          },
        },
        {
          config: {
            model: "dir/model",
          },
          source: {
            kind: "file",
            layer: "KILO_CONFIG_DIR",
            path: "/workspace/config-dir/kilo.jsonc",
          },
        },
        {
          config: {
            model: "project/model",
          },
          source: {
            kind: "file",
            layer: "project_directory_config",
            path: "/workspace/project/.kilo/kilo.jsonc",
          },
        },
      ],
      managedPaths,
      projectRoot: dependencies.runtime.cwd,
      sandboxRoot: "/tmp/oracle",
    },
    dependencies,
  );

  assert.equal(invocation.command, "npm");
  assert.deepEqual(invocation.args.slice(-3), ["kilo", "debug", "config"]);
  assert.equal(invocation.env.HOME, "/tmp/oracle/home");
  assert.equal(
    invocation.env.KILO_CONFIG,
    "/tmp/oracle/xdg/config/env/kilo.json",
  );
  assert.equal(invocation.env.KILO_CONFIG_DIR, "/tmp/oracle/config-dir");
  assert.equal(
    invocation.env.KILO_TEST_MANAGED_CONFIG_DIR,
    "/tmp/oracle/managed-config",
  );
  assert.match(
    fs.readText("/tmp/oracle/home/.gonkagate/kilo/api-key") ?? "",
    /gp-fake-kilo-oracle-secret/,
  );
  assert.match(
    fs.readText("/tmp/oracle/workspace/project/.kilo/kilo.jsonc") ?? "",
    /project\/model/,
  );
});
