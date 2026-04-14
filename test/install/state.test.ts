import assert from "node:assert/strict";
import test from "node:test";
import {
  createManagedInstallStateRecord,
  readManagedInstallState,
  writeManagedInstallState,
} from "../../src/install/state.js";
import { resolveManagedPaths } from "../../src/install/paths.js";
import { createStubbedTestInstallDependencies } from "./test-deps.js";

test("managed install state round-trips the full phase-4 record", async () => {
  const dependencies = createStubbedTestInstallDependencies();
  const managedPaths = resolveManagedPaths(
    dependencies.runtime.homeDir,
    dependencies.runtime.cwd,
    dependencies.runtime.platform,
  );
  const record = createManagedInstallStateRecord({
    configTargets: {
      project: managedPaths.projectConfigDefaultPath,
      user: managedPaths.userConfigDefaultPath,
    },
    currentTransport: "chat_completions",
    kiloCommand: "kilo",
    kiloVersion: "7.2.0",
    lastDurableSetupAt: "2026-04-14T00:00:00.000Z",
    selectedModelKey: "qwen3-235b-a22b-instruct-2507-fp8",
    selectedScope: "project",
  });

  const writeResult = await writeManagedInstallState(
    record,
    dependencies,
    managedPaths,
  );
  const readBack = await readManagedInstallState(dependencies, managedPaths);

  assert.equal(writeResult.changed, true);
  assert.equal(writeResult.path, managedPaths.installStatePath);
  assert.deepEqual(readBack, record);
});
