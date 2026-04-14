import assert from "node:assert/strict";
import test from "node:test";
import { GONKAGATE_SECRET_ENV_VAR } from "../../src/constants/gateway.js";
import {
  resolveSecretInput,
  writeManagedSecret,
} from "../../src/install/secrets.js";
import { resolveManagedPaths } from "../../src/install/paths.js";
import type { StubInstallFs } from "./test-deps.js";
import { createStubbedTestInstallDependencies } from "./test-deps.js";
import { expectInstallErrorCode } from "./test-helpers.js";

test("resolveSecretInput prefers explicit stdin over environment input", async () => {
  const secretInput = await resolveSecretInput(
    { apiKeyStdin: true },
    createStubbedTestInstallDependencies({
      input: {
        kind: "stub",
        stdinText: "  gp-from-stdin \n",
      },
      prompts: {
        kind: "stub",
        secret: "gp-from-prompt",
      },
      runtime: {
        env: {
          [GONKAGATE_SECRET_ENV_VAR]: "gp-from-env",
        },
      },
    }),
  );

  assert.deepEqual(secretInput, {
    secret: "gp-from-stdin",
    source: "api_key_stdin",
  });
});

test("resolveSecretInput prefers a non-empty environment variable over the prompt", async () => {
  const secretInput = await resolveSecretInput(
    { apiKeyStdin: false },
    createStubbedTestInstallDependencies({
      prompts: {
        kind: "stub",
        secret: "gp-from-prompt",
      },
      runtime: {
        env: {
          [GONKAGATE_SECRET_ENV_VAR]: " gp-from-env ",
        },
        stdinIsTTY: true,
        stdoutIsTTY: true,
      },
    }),
  );

  assert.deepEqual(secretInput, {
    secret: "gp-from-env",
    source: "env",
  });
});

test("resolveSecretInput uses the hidden prompt only in interactive terminals", async () => {
  const secretInput = await resolveSecretInput(
    { apiKeyStdin: false },
    createStubbedTestInstallDependencies({
      prompts: {
        kind: "stub",
        secret: "\n gp-from-prompt \n",
      },
      runtime: {
        stdinIsTTY: true,
        stdoutIsTTY: true,
      },
    }),
  );

  assert.deepEqual(secretInput, {
    secret: "gp-from-prompt",
    source: "hidden_prompt",
  });
});

test("resolveSecretInput hard-fails when --api-key-stdin is requested but stdin is empty", async () => {
  await assert.rejects(
    () =>
      resolveSecretInput(
        { apiKeyStdin: true },
        createStubbedTestInstallDependencies({
          input: {
            kind: "stub",
            stdinText: "   \n",
          },
          runtime: {
            env: {
              [GONKAGATE_SECRET_ENV_VAR]: "gp-should-not-leak",
            },
          },
        }),
      ),
    expectInstallErrorCode("secret_stdin_empty", (error) => {
      assert.doesNotMatch(error.message, /gp-should-not-leak/);
    }),
  );
});

test("resolveSecretInput fails cleanly when no non-interactive source exists and prompting is unavailable", async () => {
  await assert.rejects(
    () =>
      resolveSecretInput(
        { apiKeyStdin: false },
        createStubbedTestInstallDependencies({
          runtime: {
            stdinIsTTY: false,
            stdoutIsTTY: false,
          },
        }),
      ),
    expectInstallErrorCode("secret_prompt_unavailable", (error) => {
      assert.match(error.message, /interactive terminal/i);
    }),
  );
});

test("resolveSecretInput rejects an empty hidden prompt result without leaking secrets", async () => {
  await assert.rejects(
    () =>
      resolveSecretInput(
        { apiKeyStdin: false },
        createStubbedTestInstallDependencies({
          prompts: {
            kind: "stub",
            secret: " \n ",
          },
          runtime: {
            stdinIsTTY: true,
            stdoutIsTTY: true,
          },
        }),
      ),
    expectInstallErrorCode("secret_source_unavailable", (error) => {
      assert.doesNotMatch(error.message, /gp-/);
    }),
  );
});

test("writeManagedSecret stores the secret under managed storage and repairs permissions without rewrite", async () => {
  const dependencies = createStubbedTestInstallDependencies();
  const managedPaths = resolveManagedPaths(
    dependencies.runtime.homeDir,
    dependencies.runtime.cwd,
    dependencies.runtime.platform,
  );
  const fs = dependencies.fs as StubInstallFs;

  const firstWrite = await writeManagedSecret(
    {
      managedPaths,
      resolvedSecret: {
        secret: "gp-managed-secret",
        source: "env",
      },
    },
    dependencies,
  );

  assert.equal(firstWrite.changed, true);
  assert.equal(firstWrite.created, true);
  assert.equal(fs.readText(managedPaths.secretPath), "gp-managed-secret");
  assert.equal(fs.getEntry(managedPaths.secretPath)?.mode, 0o600);

  await dependencies.fs.chmod(managedPaths.secretPath, 0o644);

  const secondWrite = await writeManagedSecret(
    {
      managedPaths,
      resolvedSecret: {
        secret: "gp-managed-secret",
        source: "env",
      },
    },
    dependencies,
  );

  assert.deepEqual(secondWrite, {
    backupPath: undefined,
    changed: false,
    created: false,
    path: managedPaths.secretPath,
    rollbackAction: undefined,
  });
  assert.equal(fs.readText(managedPaths.secretPath), "gp-managed-secret");
  assert.equal(fs.getEntry(managedPaths.secretPath)?.mode, 0o600);
});
