import assert from "node:assert/strict";
import test from "node:test";
import { runInstallFlow } from "../../src/install/index.js";
import { resolveManagedPaths } from "../../src/install/paths.js";
import {
  formatKiloModelRef,
  buildManagedProviderConfig,
} from "../../src/install/managed-provider-config.js";
import {
  createStubbedTestInstallDependencies,
  type StubInstallFs,
} from "./test-deps.js";
import {
  createEmptyTestModelCatalog,
  createValidatedTestModelCatalog,
  TEST_VALIDATED_MODEL,
} from "./test-model-catalog.js";

function createResolvedConfigFixture(
  mutate?: (config: Record<string, unknown>) => void,
): string {
  const resolvedConfig = {
    model: formatKiloModelRef(TEST_VALIDATED_MODEL.key),
    provider: {
      gonkagate: buildManagedProviderConfig(TEST_VALIDATED_MODEL.key),
    },
  } satisfies Record<string, unknown>;
  const nextConfig = structuredClone(resolvedConfig);

  mutate?.(nextConfig);

  return `${JSON.stringify(nextConfig, null, 2)}\n`;
}

function createFlowDependencies(
  options: {
    env?: NodeJS.ProcessEnv;
    models?: "empty" | "validated";
    repository?: boolean;
    resolvedConfig?: string;
  } = {},
) {
  return createStubbedTestInstallDependencies({
    commandBehaviors: {
      "kilo --version": {
        kind: "result",
        result: {
          exitCode: 0,
          signal: null,
          stderr: "",
          stdout: "kilo 7.2.0",
        },
      },
      "npm exec --yes --package @kilocode/cli@7.2.0 -- kilo debug config": {
        kind: "result",
        result: {
          exitCode: 0,
          signal: null,
          stderr: "",
          stdout: options.resolvedConfig ?? createResolvedConfigFixture(),
        },
      },
    },
    models: {
      kind: "override",
      value:
        options.models === "empty"
          ? createEmptyTestModelCatalog()
          : createValidatedTestModelCatalog(),
    },
    runtime: {
      cwd: "/workspace/project",
      env: {
        GONKAGATE_API_KEY: "gp-flow-secret",
        ...options.env,
      },
    },
    seedDirectories: options.repository
      ? [
          {
            path: "/workspace/project/.git",
          },
        ]
      : undefined,
  });
}

test("runInstallFlow stops before writes when no validated model is available", async () => {
  const dependencies = createFlowDependencies({
    models: "empty",
    repository: true,
  });
  const managedPaths = resolveManagedPaths(
    dependencies.runtime.homeDir,
    dependencies.runtime.cwd,
    dependencies.runtime.platform,
  );
  const fs = dependencies.fs as StubInstallFs;

  const result = await runInstallFlow(
    {
      apiKeyStdin: false,
      json: true,
      yes: true,
    },
    dependencies,
  );

  assert.equal(result.status, "failed");
  assert.equal(result.errorCode, "validated_models_unavailable");
  assert.equal(fs.readText(managedPaths.secretPath), undefined);
  assert.equal(fs.readText(managedPaths.userConfigDefaultPath), undefined);
  assert.equal(fs.readText(managedPaths.installStatePath), undefined);
});

test("runInstallFlow rolls managed writes back when durable verification fails", async () => {
  const dependencies = createFlowDependencies({
    repository: true,
    resolvedConfig: createResolvedConfigFixture((config) => {
      config.model = "openai/gpt-4.1";
    }),
  });
  const managedPaths = resolveManagedPaths(
    dependencies.runtime.homeDir,
    dependencies.runtime.cwd,
    dependencies.runtime.platform,
  );
  const fs = dependencies.fs as StubInstallFs;

  const result = await runInstallFlow(
    {
      apiKeyStdin: false,
      json: true,
      yes: true,
    },
    dependencies,
  );

  assert.equal(result.status, "rolled_back");
  assert.equal(result.errorCode, "installation_rolled_back");
  assert.equal(fs.readText(managedPaths.secretPath), undefined);
  assert.equal(fs.readText(managedPaths.userConfigDefaultPath), undefined);
  assert.equal(fs.readText(managedPaths.projectConfigDefaultPath), undefined);
  assert.equal(fs.readText(managedPaths.installStatePath), undefined);
});

test("runInstallFlow keeps durable writes when only current-session verification is blocked", async () => {
  const dependencies = createFlowDependencies({
    env: {
      KILO_CONFIG_CONTENT: '{\n  "model": "openai/gpt-4.1"\n}\n',
    },
    repository: true,
  });
  const managedPaths = resolveManagedPaths(
    dependencies.runtime.homeDir,
    dependencies.runtime.cwd,
    dependencies.runtime.platform,
  );
  const fs = dependencies.fs as StubInstallFs;

  const result = await runInstallFlow(
    {
      apiKeyStdin: false,
      json: true,
      yes: true,
    },
    dependencies,
  );

  assert.equal(result.status, "blocked");
  assert.equal(result.errorCode, "effective_config_blocked");
  assert.equal(fs.readText(managedPaths.secretPath), "gp-flow-secret");
  assert.match(
    fs.readText(managedPaths.userConfigDefaultPath) ?? "",
    /"provider"/,
  );
  assert.match(
    fs.readText(managedPaths.projectConfigDefaultPath) ?? "",
    /"model": "gonkagate\//,
  );
  assert.match(
    fs.readText(managedPaths.installStatePath) ?? "",
    /"selectedScope": "project"/,
  );
});
