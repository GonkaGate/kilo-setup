import assert from "node:assert/strict";
import test from "node:test";
import {
  buildManagedProviderConfig,
  formatKiloModelRef,
} from "../../src/install/managed-provider-config.js";
import { resolveManagedPaths } from "../../src/install/paths.js";
import {
  verifyCurrentSessionKiloConfig,
  verifyEffectiveKiloConfig,
} from "../../src/install/verify-effective.js";
import { expectInstallErrorCode } from "./test-helpers.js";
import { createStubbedTestInstallDependencies } from "./test-deps.js";

function createVerifiedConfigDocument() {
  return JSON.stringify(
    {
      model: formatKiloModelRef("qwen3-235b-a22b-instruct-2507-fp8"),
      provider: {
        gonkagate: buildManagedProviderConfig(
          "qwen3-235b-a22b-instruct-2507-fp8",
        ),
      },
    },
    null,
    2,
  );
}

test("verifyEffectiveKiloConfig succeeds when local resolver and oracle agree on the managed contract", async () => {
  const managedConfigDocument = createVerifiedConfigDocument();
  const dependencies = createStubbedTestInstallDependencies({
    commandBehaviors: {
      "npm exec --yes --package @kilocode/cli@7.2.0 -- kilo debug config": {
        kind: "result",
        result: {
          exitCode: 0,
          signal: null,
          stderr: "",
          stdout: managedConfigDocument,
        },
      },
    },
    runtime: {
      cwd: "/workspace/project",
      env: {},
    },
    seedFiles: [
      {
        contents:
          JSON.stringify(
            {
              provider: {
                gonkagate: buildManagedProviderConfig(
                  "qwen3-235b-a22b-instruct-2507-fp8",
                ),
              },
            },
            null,
            2,
          ) + "\n",
        path: "/home/test/.config/kilo/kilo.jsonc",
      },
      {
        contents: `{ "model": "${formatKiloModelRef(
          "qwen3-235b-a22b-instruct-2507-fp8",
        )}" }\n`,
        path: "/workspace/project/.kilo/kilo.jsonc",
      },
    ],
  });
  const managedPaths = resolveManagedPaths(
    dependencies.runtime.homeDir,
    dependencies.runtime.cwd,
    dependencies.runtime.platform,
  );

  const result = await verifyEffectiveKiloConfig(
    {
      kiloCommand: "kilo",
      managedPaths,
      model: "qwen3-235b-a22b-instruct-2507-fp8",
      oracleSandboxRoot: "/tmp/oracle",
      projectRoot: dependencies.runtime.cwd,
      scope: "project",
    },
    dependencies,
  );

  assert.equal(result.ok, true);
  assert.equal(
    result.target.modelRef,
    "gonkagate/qwen3-235b-a22b-instruct-2507-fp8",
  );
});

test("verifyCurrentSessionKiloConfig blocks inline secret-binding overrides", async () => {
  const dependencies = createStubbedTestInstallDependencies({
    runtime: {
      cwd: "/workspace/project",
      env: {
        KILO_CONFIG_CONTENT:
          '{ "provider": { "gonkagate": { "options": { "apiKey": "{file:/tmp/leak}" } } } }',
      },
    },
    seedFiles: [
      {
        contents:
          JSON.stringify(
            {
              provider: {
                gonkagate: buildManagedProviderConfig(
                  "qwen3-235b-a22b-instruct-2507-fp8",
                ),
              },
            },
            null,
            2,
          ) + "\n",
        path: "/home/test/.config/kilo/kilo.jsonc",
      },
      {
        contents: `{ "model": "${formatKiloModelRef(
          "qwen3-235b-a22b-instruct-2507-fp8",
        )}" }\n`,
        path: "/workspace/project/.kilo/kilo.jsonc",
      },
    ],
  });
  const managedPaths = resolveManagedPaths(
    dependencies.runtime.homeDir,
    dependencies.runtime.cwd,
    dependencies.runtime.platform,
  );

  await assert.rejects(
    verifyCurrentSessionKiloConfig(
      {
        managedPaths,
        model: "qwen3-235b-a22b-instruct-2507-fp8",
        projectRoot: dependencies.runtime.cwd,
        scope: "project",
      },
      dependencies,
    ),
    expectInstallErrorCode("effective_config_blocked", (error) => {
      assert.equal(error.details.blockers[0]?.layer, "KILO_CONFIG_CONTENT");
    }),
  );
});

test("verifyEffectiveKiloConfig reports inferred non-local influence when the oracle diverges without a local blocker", async () => {
  const dependencies = createStubbedTestInstallDependencies({
    commandBehaviors: {
      "npm exec --yes --package @kilocode/cli@7.2.0 -- kilo debug config": {
        kind: "result",
        result: {
          exitCode: 0,
          signal: null,
          stderr: "",
          stdout:
            JSON.stringify(
              {
                model: "custom/other",
                provider: {
                  gonkagate: buildManagedProviderConfig(
                    "qwen3-235b-a22b-instruct-2507-fp8",
                  ),
                },
              },
              null,
              2,
            ) + "\n",
        },
      },
    },
    runtime: {
      cwd: "/workspace/project",
      env: {},
    },
    seedFiles: [
      {
        contents:
          JSON.stringify(
            {
              provider: {
                gonkagate: buildManagedProviderConfig(
                  "qwen3-235b-a22b-instruct-2507-fp8",
                ),
              },
            },
            null,
            2,
          ) + "\n",
        path: "/home/test/.config/kilo/kilo.jsonc",
      },
      {
        contents: `{ "model": "${formatKiloModelRef(
          "qwen3-235b-a22b-instruct-2507-fp8",
        )}" }\n`,
        path: "/workspace/project/.kilo/kilo.jsonc",
      },
    ],
  });
  const managedPaths = resolveManagedPaths(
    dependencies.runtime.homeDir,
    dependencies.runtime.cwd,
    dependencies.runtime.platform,
  );

  await assert.rejects(
    verifyEffectiveKiloConfig(
      {
        kiloCommand: "kilo",
        managedPaths,
        model: "qwen3-235b-a22b-instruct-2507-fp8",
        oracleSandboxRoot: "/tmp/oracle",
        projectRoot: dependencies.runtime.cwd,
        scope: "project",
      },
      dependencies,
    ),
    expectInstallErrorCode("effective_config_blocked", (error) => {
      assert.equal(error.details.blockers[0]?.layer, "inferred_non_local");
    }),
  );
});
