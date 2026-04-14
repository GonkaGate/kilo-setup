import assert from "node:assert/strict";
import test from "node:test";
import {
  applyManagedConfigMutations,
  readManagedConfigDocument,
  writeManagedConfigDocument,
} from "../../src/install/config.js";
import type { ManagedConfigMutation } from "../../src/install/contracts/managed-config.js";
import { resolveManagedPaths } from "../../src/install/paths.js";
import type { StubInstallFs } from "./test-deps.js";
import { createStubbedTestInstallDependencies } from "./test-deps.js";
import { expectInstallErrorCode } from "./test-helpers.js";

const TARGET_PATH = "/workspace/project/.kilo/kilo.jsonc";
const JSONC_CONFIG_WITH_COMMENT =
  '{\r\n  // keep this comment\r\n  "provider": {\r\n    "anthropic": {},\r\n  },\r\n}\r\n';
const INVALID_JSONC_CONFIG = '{\n  "model": ,\n}\n';
const NON_OBJECT_ROOT_CONFIG = '["not", "an", "object"]\n';
const SCALAR_PROVIDER_CONFIG = '{\n  "provider": "oops"\n}\n';
const ACTIVATION_MUTATIONS: readonly ManagedConfigMutation[] = [
  {
    kind: "set",
    path: ["model"],
    value: "gonkagate/qwen3-235b-a22b-instruct-2507-fp8",
  },
  {
    kind: "set",
    path: ["provider", "gonkagate"],
    value: {
      name: "GonkaGate",
    },
  },
] as const;

function createTargetDependencies(contents?: string) {
  return createStubbedTestInstallDependencies(
    contents === undefined
      ? {}
      : {
          seedFiles: [
            {
              contents,
              path: TARGET_PATH,
            },
          ],
        },
  );
}

async function readTestDocument(
  options: {
    contents?: string;
    target?: "project_config" | "user_config";
  } = {},
) {
  return readManagedConfigDocument(
    options.target ?? "user_config",
    TARGET_PATH,
    createTargetDependencies(options.contents),
  );
}

test("readManagedConfigDocument treats a missing target as an empty config object", async () => {
  const document = await readTestDocument();

  assert.equal(document.exists, false);
  assert.equal(document.contents, "");
  assert.equal(document.eol, "\n");
  assert.deepEqual(document.initialValue, {});
});

test("applyManagedConfigMutations writes stable output for planned mutations", async () => {
  const document = await readTestDocument();
  const output = applyManagedConfigMutations(document, ACTIVATION_MUTATIONS);

  assert.match(
    output,
    /"model": "gonkagate\/qwen3-235b-a22b-instruct-2507-fp8"/,
  );
  assert.match(output, /"provider"/);
  assert.match(output, /"gonkagate"/);
});

test("applyManagedConfigMutations preserves JSONC comments, trailing commas, and CRLF formatting", async () => {
  const document = await readTestDocument({
    contents: JSONC_CONFIG_WITH_COMMENT,
  });

  const output = applyManagedConfigMutations(document, [
    {
      kind: "set",
      path: ["provider", "gonkagate"],
      value: {
        name: "GonkaGate",
      },
    },
  ]);

  assert.match(output, /keep this comment/u);
  assert.match(output, /\r\n/u);
  assert.match(output, /"anthropic"/u);
  assert.match(output, /"gonkagate"/u);
});

test("readManagedConfigDocument rejects JSON or JSONC parse failures as typed install errors", async () => {
  await assert.rejects(
    () => readTestDocument({ contents: INVALID_JSONC_CONFIG }),
    expectInstallErrorCode("managed_config_parse_failed"),
  );
});

test("readManagedConfigDocument rejects non-object roots as typed install errors", async () => {
  await assert.rejects(
    () =>
      readTestDocument({
        contents: NON_OBJECT_ROOT_CONFIG,
        target: "project_config",
      }),
    expectInstallErrorCode("managed_config_parse_failed"),
  );
});

test("applyManagedConfigMutations rejects impossible merges when a parent path is scalar", async () => {
  const document = await readTestDocument({
    contents: SCALAR_PROVIDER_CONFIG,
  });

  assert.throws(
    () =>
      applyManagedConfigMutations(document, [
        {
          kind: "set",
          path: ["provider", "gonkagate"],
          value: {
            name: "GonkaGate",
          },
        },
      ]),
    expectInstallErrorCode("managed_config_merge_failed"),
  );
});

test("writeManagedConfigDocument creates a backup under managed user storage before replacement", async () => {
  const dependencies = createStubbedTestInstallDependencies({
    seedFiles: [
      {
        contents: '{\n  "model": "old/model"\n}\n',
        path: TARGET_PATH,
      },
    ],
  });
  const managedPaths = resolveManagedPaths(
    dependencies.runtime.homeDir,
    dependencies.runtime.cwd,
    dependencies.runtime.platform,
  );
  const fs = dependencies.fs as StubInstallFs;
  const document = await readManagedConfigDocument(
    "project_config",
    TARGET_PATH,
    dependencies,
  );

  const writeResult = await writeManagedConfigDocument({
    backupDirectoryPath: managedPaths.projectConfigBackupDirectory,
    dependencies,
    document,
    nextContents: '{\n  "model": "new/model"\n}\n',
  });

  assert.equal(writeResult.changed, true);
  assert.equal(writeResult.created, false);
  assert.match(writeResult.backupPath ?? "", /project-config/);
  assert.equal(fs.readText(TARGET_PATH), '{\n  "model": "new/model"\n}\n');
  assert.equal(
    fs.readText(writeResult.backupPath ?? ""),
    '{\n  "model": "old/model"\n}\n',
  );
});
