import assert from "node:assert/strict";
import test from "node:test";
import { CONTRACT_METADATA } from "../src/constants/contract.js";
import { readText } from "./contract-helpers.js";

interface ReleasePleaseConfig {
  "include-component-in-tag"?: boolean;
  "include-v-in-tag"?: boolean;
  packages?: Record<string, { "extra-files"?: string[] }>;
  "release-type"?: string;
}

interface ReleasePleaseManifest {
  ".": string;
}

test("release automation scaffolding matches the repository versioning contract", () => {
  const config = JSON.parse(
    readText("release-please-config.json"),
  ) as ReleasePleaseConfig;
  const manifest = JSON.parse(
    readText(".release-please-manifest.json"),
  ) as ReleasePleaseManifest;
  const contractSource = readText("src/constants/contract.ts");
  const releaseWorkflow = readText(".github/workflows/release-please.yml");
  const publishWorkflow = readText(".github/workflows/publish.yml");

  assert.equal(config["release-type"], "node");
  assert.equal(config["include-component-in-tag"], false);
  assert.equal(config["include-v-in-tag"], true);
  assert.deepEqual(config.packages?.["."]?.["extra-files"], [
    "src/constants/contract.ts",
  ]);
  assert.equal(manifest["."], CONTRACT_METADATA.cliVersion);
  assert.match(
    contractSource,
    /cliVersion:\s*"[^"]+",\s*\/\/ x-release-please-version/,
  );

  assert.match(releaseWorkflow, /googleapis\/release-please-action/);
  assert.match(releaseWorkflow, /actions:\s*write/);
  assert.match(releaseWorkflow, /pull-requests:\s*write/);
  assert.match(releaseWorkflow, /actions\/workflows\/publish\.yml\/dispatches/);
  assert.match(releaseWorkflow, /"action\\":\\"publish\\"/);
  assert.match(releaseWorkflow, /"publish_ref\\":\\"\$\{PUBLISH_REF\}\\"/);

  assert.match(publishWorkflow, /name:\s*Publish \(npm\)/);
  assert.match(publishWorkflow, /workflow_dispatch:/);
  assert.match(publishWorkflow, /environment:\s*release/);
  assert.match(publishWorkflow, /id-token:\s*write/);
  assert.match(publishWorkflow, /npm publish --provenance --access public/);
});

test("publishing docs describe the trusted publishing handshake with exact values", () => {
  const publishingDoc = readText("docs/publishing.md");

  assert.match(publishingDoc, new RegExp(CONTRACT_METADATA.packageName));
  assert.match(publishingDoc, /release-please/i);
  assert.match(publishingDoc, /publish\.yml/);
  assert.match(publishingDoc, /Environment name`: `release`/);
  assert.match(publishingDoc, /Organization or user`: `GonkaGate`/);
  assert.match(publishingDoc, /Repository`: `kilo-setup`/);
  assert.match(publishingDoc, /npm publish --provenance --access public/);
});
