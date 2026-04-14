import assert from "node:assert/strict";
import test from "node:test";
import {
  resolveManagedPaths,
  resolveInspectableSystemManagedConfigPaths,
  resolveProjectConfigTargetPath,
  resolveUserConfigTargetPath,
} from "../../src/install/paths.js";
import { createStubbedTestInstallDependencies } from "./test-deps.js";

test("resolveManagedPaths returns the POSIX managed secret, install-state, and backup roots", () => {
  const managedPaths = resolveManagedPaths(
    "/home/daniil",
    "/workspace/repo",
    "linux",
  );

  assert.equal(managedPaths.secretPath, "/home/daniil/.gonkagate/kilo/api-key");
  assert.equal(
    managedPaths.installStatePath,
    "/home/daniil/.gonkagate/kilo/install-state.json",
  );
  assert.equal(
    managedPaths.userConfigBackupDirectory,
    "/home/daniil/.gonkagate/kilo/backups/user-config",
  );
  assert.equal(
    managedPaths.projectConfigBackupDirectory,
    "/home/daniil/.gonkagate/kilo/backups/project-config",
  );
});

test("resolveManagedPaths returns Windows-profile scoped managed roots", () => {
  const managedPaths = resolveManagedPaths(
    "C:\\Users\\Daniil",
    "C:\\work\\repo",
    "win32",
  );

  assert.equal(
    managedPaths.secretPath,
    "C:\\Users\\Daniil\\.gonkagate\\kilo\\api-key",
  );
  assert.equal(
    managedPaths.installStatePath,
    "C:\\Users\\Daniil\\.gonkagate\\kilo\\install-state.json",
  );
  assert.equal(
    managedPaths.projectConfigDefaultPath,
    "C:\\work\\repo\\.kilo\\kilo.jsonc",
  );
});

test("resolveUserConfigTargetPath prefers kilo.jsonc, then kilo.json, then creates kilo.jsonc", async () => {
  const dependencies = createStubbedTestInstallDependencies({
    seedFiles: [
      {
        path: "/home/test/.config/kilo/kilo.json",
      },
    ],
  });
  const managedPaths = resolveManagedPaths(
    dependencies.runtime.homeDir,
    dependencies.runtime.cwd,
    dependencies.runtime.platform,
  );

  const withJson = await resolveUserConfigTargetPath(
    dependencies,
    managedPaths,
  );
  assert.equal(withJson.path, "/home/test/.config/kilo/kilo.json");

  await dependencies.fs.writeFile("/home/test/.config/kilo/kilo.jsonc", "{}", {
    encoding: "utf8",
  });

  const withJsonc = await resolveUserConfigTargetPath(
    dependencies,
    managedPaths,
  );
  assert.equal(withJsonc.path, "/home/test/.config/kilo/kilo.jsonc");
});

test("resolveProjectConfigTargetPath prefers .kilo/kilo.jsonc, then .kilo/kilo.json, then creates .kilo/kilo.jsonc", async () => {
  const dependencies = createStubbedTestInstallDependencies({
    seedFiles: [
      {
        path: "/workspace/project/.kilo/kilo.json",
      },
    ],
  });
  const managedPaths = resolveManagedPaths(
    dependencies.runtime.homeDir,
    dependencies.runtime.cwd,
    dependencies.runtime.platform,
  );

  const withJson = await resolveProjectConfigTargetPath(
    dependencies,
    managedPaths,
  );
  assert.equal(withJson.path, "/workspace/project/.kilo/kilo.json");

  await dependencies.fs.writeFile("/workspace/project/.kilo/kilo.jsonc", "{}", {
    encoding: "utf8",
  });

  const withJsonc = await resolveProjectConfigTargetPath(
    dependencies,
    managedPaths,
  );
  assert.equal(withJsonc.path, "/workspace/project/.kilo/kilo.jsonc");
});

test("resolveInspectableSystemManagedConfigPaths follows the Kilo system-managed config contract", () => {
  assert.deepEqual(resolveInspectableSystemManagedConfigPaths({}, "linux"), [
    "/etc/kilo/kilo.jsonc",
    "/etc/kilo/kilo.json",
    "/etc/kilo/opencode.jsonc",
    "/etc/kilo/opencode.json",
  ]);
  assert.deepEqual(resolveInspectableSystemManagedConfigPaths({}, "darwin"), [
    "/Library/Application Support/kilo/kilo.jsonc",
    "/Library/Application Support/kilo/kilo.json",
    "/Library/Application Support/kilo/opencode.jsonc",
    "/Library/Application Support/kilo/opencode.json",
  ]);
  assert.deepEqual(
    resolveInspectableSystemManagedConfigPaths(
      {
        ProgramData: "C:\\ProgramData",
      },
      "win32",
    ),
    [
      "C:\\ProgramData\\kilo\\kilo.jsonc",
      "C:\\ProgramData\\kilo\\kilo.json",
      "C:\\ProgramData\\kilo\\opencode.jsonc",
      "C:\\ProgramData\\kilo\\opencode.json",
    ],
  );
});
