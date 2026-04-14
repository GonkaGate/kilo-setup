import assert from "node:assert/strict";
import test from "node:test";
import { CONTRACT_METADATA } from "../src/constants/contract.js";
import {
  GONKAGATE_BASE_URL,
  GONKAGATE_MANAGED_SECRET_PATH,
  GONKAGATE_PROVIDER_ID,
} from "../src/constants/gateway.js";
import {
  CURATED_MODEL_REGISTRY,
  getRecommendedProductionDefaultModel,
  getValidatedModelKeys,
} from "../src/constants/models.js";
import { buildManagedProviderConfig } from "../src/install/managed-provider-config.js";
import {
  KILO_CONFIG_CONTENT_ENV_VAR,
  KILO_CONFIG_DIR_ENV_VAR,
  KILO_CONFIG_ENV_VAR,
  KILO_FALLBACK_COMMAND,
  KILO_GLOBAL_CONFIG_FILE_ORDER,
  KILO_LEGACY_CONFIG_FILES,
  KILO_PROJECT_ROOT_CONFIG_FILE_ORDER,
  KILO_PREFERRED_GLOBAL_CONFIG,
  KILO_PREFERRED_PROJECT_CONFIG,
  KILO_PRIMARY_COMMAND,
} from "../src/install/kilo.js";
import { readText } from "./contract-helpers.js";

interface PackageJson {
  bin?: Record<string, string>;
  bugs?: {
    url?: string;
  };
  description?: string;
  engines?: Record<string, string>;
  files?: string[];
  homepage?: string;
  name?: string;
  repository?: {
    type?: string;
    url?: string;
  };
  scripts?: Record<string, string>;
  type?: string;
  version?: string;
}

test("package metadata matches the shipped Kilo runtime contract", () => {
  const packageJson = JSON.parse(readText("package.json")) as PackageJson;

  assert.equal(packageJson.name, CONTRACT_METADATA.packageName);
  assert.match(
    packageJson.description ?? "",
    /Setup CLI for configuring local Kilo to use GonkaGate/i,
  );
  assert.equal(packageJson.type, "module");
  assert.equal(packageJson.version, CONTRACT_METADATA.cliVersion);
  assert.equal(
    packageJson.bin?.[CONTRACT_METADATA.binName],
    CONTRACT_METADATA.binPath,
  );
  assert.equal(
    packageJson.bin?.[CONTRACT_METADATA.secondaryBinName],
    CONTRACT_METADATA.binPath,
  );
  assert.equal(packageJson.engines?.node, ">=22.14.0");
  assert.equal(packageJson.files?.includes("dist"), true);
  assert.equal(packageJson.files?.includes("docs"), true);
  assert.equal(
    packageJson.homepage,
    "https://github.com/GonkaGate/kilo-setup#readme",
  );
  assert.equal(packageJson.repository?.type, "git");
  assert.equal(
    packageJson.repository?.url,
    "git+https://github.com/GonkaGate/kilo-setup.git",
  );
  assert.equal(
    packageJson.bugs?.url,
    "https://github.com/GonkaGate/kilo-setup/issues",
  );
  assert.match(packageJson.scripts?.build ?? "", /tsconfig\.build\.json/);
  assert.match(packageJson.scripts?.test ?? "", /npm run build/);
  assert.match(packageJson.scripts?.ci ?? "", /npm run typecheck/);
  assert.match(packageJson.scripts?.ci ?? "", /npm run test/);
  assert.match(packageJson.scripts?.ci ?? "", /npm run format:check/);
  assert.match(packageJson.scripts?.ci ?? "", /npm run package:check/);
});

test("prettier ignore matches the release-please changelog workflow", () => {
  const prettierIgnore = readText(".prettierignore");

  assert.match(prettierIgnore, /^dist$/m);
  assert.match(prettierIgnore, /^CHANGELOG\.md$/m);
});

test("constants use Kilo-specific defaults and leave OpenCode env vars out", () => {
  assert.equal(KILO_PRIMARY_COMMAND, "kilo");
  assert.equal(KILO_FALLBACK_COMMAND, "kilocode");
  assert.equal(KILO_CONFIG_ENV_VAR, "KILO_CONFIG");
  assert.equal(KILO_CONFIG_DIR_ENV_VAR, "KILO_CONFIG_DIR");
  assert.equal(KILO_CONFIG_CONTENT_ENV_VAR, "KILO_CONFIG_CONTENT");
  assert.equal(KILO_PREFERRED_GLOBAL_CONFIG, "~/.config/kilo/kilo.jsonc");
  assert.equal(KILO_PREFERRED_PROJECT_CONFIG, ".kilo/kilo.jsonc");
  assert.deepEqual(KILO_GLOBAL_CONFIG_FILE_ORDER, [
    "config.json",
    "kilo.json",
    "kilo.jsonc",
    "opencode.json",
    "opencode.jsonc",
  ]);
  assert.deepEqual(KILO_PROJECT_ROOT_CONFIG_FILE_ORDER, [
    "kilo.jsonc",
    "kilo.json",
    "opencode.jsonc",
    "opencode.json",
  ]);
  assert.equal(GONKAGATE_PROVIDER_ID, "gonkagate");
  assert.equal(GONKAGATE_BASE_URL, "https://api.gonkagate.com/v1");
  assert.equal(GONKAGATE_MANAGED_SECRET_PATH, "~/.gonkagate/kilo/api-key");
  assert.equal(KILO_LEGACY_CONFIG_FILES.includes("opencode.json"), true);
  assert.equal(KILO_LEGACY_CONFIG_FILES.includes("opencode.jsonc"), true);

  const runtimeSource = [
    readText("src/install/kilo.ts"),
    readText("src/cli/parse.ts"),
  ].join("\n");
  assert.doesNotMatch(runtimeSource, /OPENCODE_CONFIG/);
});

test("curated model registry exposes the shipped validated default", () => {
  const model = CURATED_MODEL_REGISTRY["qwen3-235b-a22b-instruct-2507-fp8"];

  assert.equal(model.adapterPackage, "@ai-sdk/openai-compatible");
  assert.equal(model.limits?.context, 262144);
  assert.equal("output" in (model.limits ?? {}), false);
  assert.equal(model.modelId, "qwen/qwen3-235b-a22b-instruct-2507-fp8");
  assert.equal(model.transport, "chat_completions");
  assert.equal(model.validationStatus, "validated");
  assert.deepEqual(getValidatedModelKeys(), [
    "qwen3-235b-a22b-instruct-2507-fp8",
  ]);
  assert.equal(
    getRecommendedProductionDefaultModel()?.key,
    "qwen3-235b-a22b-instruct-2507-fp8",
  );
});

test("managed provider config omits an installer-owned output token cap", () => {
  const providerConfig = buildManagedProviderConfig(
    "qwen3-235b-a22b-instruct-2507-fp8",
  ) as {
    models: Record<string, { limit?: { context?: number; output?: number } }>;
  };

  assert.equal(
    providerConfig.models["qwen3-235b-a22b-instruct-2507-fp8"]?.limit?.context,
    262144,
  );
  assert.equal(
    "output" in
      (providerConfig.models["qwen3-235b-a22b-instruct-2507-fp8"]?.limit ?? {}),
    false,
  );
});
