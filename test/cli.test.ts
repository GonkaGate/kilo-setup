import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import test from "node:test";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import type {
  CuratedModelKey,
  RecommendedProductionDefaultCuratedModel,
  ValidatedCuratedModel,
} from "../src/constants/models.js";
import { CONTRACT_METADATA } from "../src/constants/contract.js";
import { GONKAGATE_BASE_URL } from "../src/constants/gateway.js";
import { parseCliOptions, renderCliEntrypointError, run } from "../src/cli.js";
import type { InstallSelectOptions } from "../src/install/deps.js";
import type { InstallModelCatalog } from "../src/install/model-catalog.js";
import {
  buildManagedProviderConfig,
  formatKiloModelRef,
} from "../src/install/managed-provider-config.js";
import { createStubbedTestInstallDependencies } from "./install/test-deps.js";
import { escapeRegExp, repoRoot } from "./contract-helpers.js";

const MODEL_KEY = "qwen3-235b-a22b-instruct-2507-fp8" as const;
const VALIDATED_MODEL: RecommendedProductionDefaultCuratedModel = {
  adapterPackage: "@ai-sdk/openai-compatible",
  displayName: "Qwen3 235B A22B Instruct 2507 FP8",
  key: MODEL_KEY,
  limits: {
    context: 262144,
    output: 8192,
  },
  modelId: "qwen/qwen3-235b-a22b-instruct-2507-fp8",
  recommended: true,
  transport: "chat_completions",
  validationStatus: "validated",
};

type TestSelectOption = <TValue extends string>(
  options: InstallSelectOptions<TValue>,
) => Promise<TValue>;

interface BufferWriter {
  contents: string;
  write(text: string): void;
}

function createBufferWriter(): BufferWriter {
  return {
    contents: "",
    write(text) {
      this.contents += text;
    },
  };
}

function createValidatedModelCatalog(): InstallModelCatalog {
  return {
    getCuratedModelByKey(key) {
      return key === MODEL_KEY ? VALIDATED_MODEL : undefined;
    },
    getRecommendedProductionDefaultModel() {
      return VALIDATED_MODEL;
    },
    getValidatedModels() {
      return [VALIDATED_MODEL];
    },
  };
}

function createResolvedConfigFixture(
  mutate?: (config: Record<string, unknown>) => void,
): string {
  const resolvedConfig = {
    model: formatKiloModelRef(MODEL_KEY),
    provider: {
      gonkagate: buildManagedProviderConfig(MODEL_KEY),
    },
  } satisfies Record<string, unknown>;
  const nextConfig = structuredClone(resolvedConfig);

  mutate?.(nextConfig);

  return `${JSON.stringify(nextConfig, null, 2)}\n`;
}

function createCliDependencies(
  options: {
    env?: NodeJS.ProcessEnv;
    interactive?: boolean;
    promptSecret?: string;
    repository?: boolean;
    resolvedConfig?: string;
    selectOption?: TestSelectOption;
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
      value: createValidatedModelCatalog(),
    },
    prompts:
      options.selectOption === undefined
        ? {
            kind: "stub",
            secret: options.promptSecret ?? "gp-test-secret",
          }
        : {
            kind: "override",
            value: {
              readSecret: async () => options.promptSecret ?? "gp-test-secret",
              selectOption: async <TValue extends string>(
                promptOptions: InstallSelectOptions<TValue>,
              ): Promise<TValue> => await options.selectOption!(promptOptions),
            },
          },
    runtime: {
      cwd: "/workspace/project",
      env: options.env ?? {},
      stdinIsTTY: options.interactive ?? false,
      stdoutIsTTY: options.interactive ?? false,
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

test("parseCliOptions reads supported runtime flags", () => {
  const options = parseCliOptions([
    "--scope",
    "project",
    "--model",
    MODEL_KEY,
    "--cwd",
    "/tmp/project",
    "--yes",
    "--json",
    "--api-key-stdin",
  ]);

  assert.equal(options.scope, "project");
  assert.equal(options.modelKey, MODEL_KEY);
  assert.equal(options.cwd, "/tmp/project");
  assert.equal(options.yes, true);
  assert.equal(options.json, true);
  assert.equal(options.apiKeyStdin, true);
});

test("parseCliOptions rejects plain api-key flags", () => {
  assert.throws(
    () => parseCliOptions(["--api-key", "gp-secret-value"]),
    /intentionally unsupported/i,
  );
  assert.throws(
    () => parseCliOptions(["--api-key=gp-secret-value"]),
    /intentionally unsupported/i,
  );
});

test("CLI wrapper exposes the runtime help surface", () => {
  const binPath = resolve(repoRoot, CONTRACT_METADATA.binPath);
  const helpResult = spawnSync(process.execPath, [binPath, "--help"], {
    cwd: repoRoot,
    encoding: "utf8",
  });

  assert.equal(helpResult.status, 0);
  assert.match(helpResult.stdout, /Usage: kilo-setup/i);
  assert.match(helpResult.stdout, /Configure Kilo to use GonkaGate/i);
  assert.match(
    helpResult.stdout,
    /validated Qwen3 235B A22B Instruct 2507 FP8/i,
  );
  assert.match(helpResult.stdout, /--scope <scope>/);
  assert.match(helpResult.stdout, /--api-key-stdin/);
  assert.match(helpResult.stdout, /GONKAGATE_API_KEY/);
  assert.match(
    helpResult.stdout,
    new RegExp(escapeRegExp(CONTRACT_METADATA.publicEntrypoint)),
  );
  assert.match(helpResult.stdout, new RegExp(escapeRegExp(GONKAGATE_BASE_URL)));
  assert.match(
    helpResult.stdout,
    /Current transport target: chat\/completions/,
  );
});

test("interactive runs show the public model picker even when one validated model is available", async () => {
  const promptMessages: string[] = [];
  const promptChoices: string[][] = [];
  const stdout = createBufferWriter();
  const stderr = createBufferWriter();
  const dependencies = createCliDependencies({
    interactive: true,
    promptSecret: "gp-from-prompt",
    repository: true,
    selectOption: async (options) => {
      promptMessages.push(options.message);
      promptChoices.push(options.choices.map((choice) => choice.label));
      return options.defaultValue ?? options.choices[0]?.value ?? MODEL_KEY;
    },
  });

  const result = await run([], {
    dependencies,
    stderr,
    stdout,
  });

  assert.equal(result.exitCode, 0);
  assert.equal(stderr.contents, "");
  assert.match(
    promptMessages[0] ?? "",
    /Choose the GonkaGate model to configure for Kilo/i,
  );
  assert.deepEqual(promptChoices[0], [
    "Qwen3 235B A22B Instruct 2507 FP8 (Recommended)",
  ]);
  assert.match(
    promptMessages[1] ?? "",
    /Where should GonkaGate be activated for Kilo on this machine/i,
  );
});

test("--yes auto-selects the recommended model and scope without prompting", async () => {
  let selectCallCount = 0;
  const stdout = createBufferWriter();
  const stderr = createBufferWriter();
  const dependencies = createCliDependencies({
    interactive: true,
    repository: true,
    selectOption: async (options) => {
      selectCallCount += 1;
      return options.defaultValue ?? options.choices[0]?.value ?? MODEL_KEY;
    },
  });

  const result = await run(["--yes", "--json"], {
    dependencies,
    stderr,
    stdout,
  });

  assert.equal(result.exitCode, 0);
  assert.equal(selectCallCount, 0);
  assert.match(stdout.contents, /"status": "installed"/);
  assert.match(stdout.contents, /"scope": "project"/);
});

test("non-interactive runs require --scope or --yes", async () => {
  const stdout = createBufferWriter();
  const stderr = createBufferWriter();
  const dependencies = createCliDependencies({
    env: {
      GONKAGATE_API_KEY: "gp-from-env",
    },
    repository: true,
  });

  const result = await run(["--json"], {
    dependencies,
    stderr,
    stdout,
  });

  assert.equal(result.exitCode, 1);
  assert.equal(stderr.contents, "");
  assert.match(stdout.contents, /"status": "failed"/);
  assert.match(stdout.contents, /"errorCode": "scope_selection_required"/);
});

test("CLI emits structured JSON success payloads for the real installer flow", async () => {
  const stdout = createBufferWriter();
  const stderr = createBufferWriter();
  const dependencies = createCliDependencies({
    env: {
      GONKAGATE_API_KEY: "gp-from-env",
    },
    repository: true,
  });

  const result = await run(["--json", "--yes"], {
    dependencies,
    stderr,
    stdout,
  });

  assert.equal(result.exitCode, 0);
  assert.match(stdout.contents, /"status": "installed"/);
  assert.match(stdout.contents, /"ok": true/);
  assert.match(stdout.contents, /"providerId": "gonkagate"/);
  assert.match(stdout.contents, /"transport": "chat_completions"/);
  assert.doesNotMatch(stdout.contents, /gp-from-env/);
});

test("CLI emits structured JSON blocked payloads when current-session overrides prevent success", async () => {
  const stdout = createBufferWriter();
  const stderr = createBufferWriter();
  const dependencies = createCliDependencies({
    env: {
      GONKAGATE_API_KEY: "gp-from-env",
      KILO_CONFIG_CONTENT: '{\n  "model": "openai/gpt-4.1"\n}\n',
    },
    repository: true,
  });

  const result = await run(["--json", "--yes"], {
    dependencies,
    stderr,
    stdout,
  });

  assert.equal(result.exitCode, 1);
  assert.match(stdout.contents, /"status": "blocked"/);
  assert.match(stdout.contents, /"errorCode": "effective_config_blocked"/);
  assert.match(stdout.contents, /KILO_CONFIG_CONTENT/);
  assert.doesNotMatch(stdout.contents, /gp-from-env/);
});

test("CLI omits undefined blocked kilo details from JSON output", async () => {
  const stdout = createBufferWriter();
  const stderr = createBufferWriter();

  const result = await run(["--json", "--yes"], {
    dependencies: createStubbedTestInstallDependencies({
      models: {
        kind: "override",
        value: createValidatedModelCatalog(),
      },
      runtime: {
        cwd: "/workspace/project",
        env: {},
        stdinIsTTY: false,
        stdoutIsTTY: false,
      },
    }),
    stderr,
    stdout,
  });

  assert.equal(result.exitCode, 1);
  assert.match(stdout.contents, /"status": "blocked"/);
  assert.match(stdout.contents, /"errorCode": "kilo_not_found"/);
  assert.doesNotMatch(stdout.contents, /"kilo": "undefined"/);
});

test("renderCliEntrypointError redacts unexpected fatal error messages", () => {
  const renderedError = renderCliEntrypointError(
    new Error("gp-live-secret Bearer session-token"),
  );

  assert.equal(renderedError.exitCode, 1);
  assert.doesNotMatch(renderedError.stderrText ?? "", /gp-live-secret/);
  assert.doesNotMatch(renderedError.stderrText ?? "", /Bearer session-token/);
  assert.match(renderedError.stderrText ?? "", /\[REDACTED\]/);
});

test("bin wrapper reuses the shared CLI entrypoint error renderer", async () => {
  const binModule = (await import(
    pathToFileURL(resolve(repoRoot, CONTRACT_METADATA.binPath)).href
  )) as {
    renderCliEntrypointError: typeof renderCliEntrypointError;
  };
  const error = new Error("gp-bin-secret");

  assert.deepEqual(
    binModule.renderCliEntrypointError(error),
    renderCliEntrypointError(error),
  );
});

test("CLI emits structured JSON failed payloads for resolved-config mismatches", async () => {
  const stdout = createBufferWriter();
  const stderr = createBufferWriter();
  const dependencies = createCliDependencies({
    env: {
      GONKAGATE_API_KEY: "gp-from-env",
    },
    repository: true,
    resolvedConfig: createResolvedConfigFixture((config) => {
      config.model = "openai/gpt-4.1-mini";
    }),
  });

  const result = await run(["--json", "--yes"], {
    dependencies,
    stderr,
    stdout,
  });

  assert.equal(result.exitCode, 1);
  assert.match(stdout.contents, /"status": "rolled_back"/);
  assert.match(stdout.contents, /"errorCode": "installation_rolled_back"/);
});

test("human-readable success output ends with the minimal next step", async () => {
  const stdout = createBufferWriter();
  const stderr = createBufferWriter();
  const dependencies = createCliDependencies({
    env: {
      GONKAGATE_API_KEY: "gp-from-env",
    },
    repository: true,
  });

  const result = await run(["--yes"], {
    dependencies,
    stderr,
    stdout,
  });

  assert.equal(result.exitCode, 0);
  assert.equal(stderr.contents, "");
  assert.match(stdout.contents, /GonkaGate is configured for Kilo\./);
  assert.match(stdout.contents, /Run kilo\n$/);
});
