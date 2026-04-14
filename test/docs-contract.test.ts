import assert from "node:assert/strict";
import test from "node:test";
import { CONTRACT_METADATA } from "../src/constants/contract.js";
import { GONKAGATE_BASE_URL } from "../src/constants/gateway.js";
import {
  assertMatchesAll,
  escapeRegExp,
  readText,
} from "./contract-helpers.js";

test("docs describe the shipped Kilo runtime and the remaining public proof gate honestly", () => {
  const readme = readText("README.md");
  const howItWorks = readText("docs/how-it-works.md");
  const security = readText("docs/security.md");
  const troubleshooting = readText("docs/troubleshooting.md");
  const releaseReadiness = readText("docs/release-readiness.md");
  const docsIndex = readText("docs/README.md");
  const agents = readText("AGENTS.md");
  const combined = [
    readme,
    howItWorks,
    security,
    troubleshooting,
    releaseReadiness,
    docsIndex,
    agents,
  ].join("\n");

  assertMatchesAll(combined, [
    new RegExp(escapeRegExp(CONTRACT_METADATA.packageName)),
    new RegExp(escapeRegExp(CONTRACT_METADATA.publicEntrypoint)),
    /@kilocode\/cli/,
    /\bkilo\b/,
    /\bkilocode\b/,
    /7\.2\.0/,
    /KILO_CONFIG/,
    /KILO_CONFIG_DIR/,
    /KILO_CONFIG_CONTENT/,
    /~\/\.config\/kilo\/kilo\.jsonc/,
    /\.kilo\/kilo\.jsonc/,
    new RegExp(escapeRegExp(GONKAGATE_BASE_URL)),
    /chat\/completions|chat_completions/,
    /runtime is shipped|validated default|Qwen3 235B A22B Instruct 2507 FP8|blocks unsupported kilo|rollback/i,
    /no plain `--api-key`|never accept plain `--api-key`|never accept `--api-key`/i,
    /provider\.gonkagate/,
    /each participating machine|each machine/i,
    /real-path Kilo verification is not (the )?production default/i,
  ]);

  assert.doesNotMatch(combined, /OPENCODE_CONFIG/);
  assert.doesNotMatch(combined, /~\/\.config\/opencode\/opencode\.json/);
  assert.doesNotMatch(
    combined,
    /GONKAGATE_API_KEY=gp-[^\n]*@gonkagate\/kilo-setup/u,
  );
});

test("copied PRD is present under the Kilo setup specs path", () => {
  const prd = readText("docs/specs/kilo-setup-prd/spec.md");

  assert.match(prd, /# GonkaGate `kilo` Setup PRD/);
  assert.match(prd, /@kilocode\/cli/);
  assert.match(prd, /KILO_CONFIG/);
  assert.match(prd, /kilo debug config/);
});
