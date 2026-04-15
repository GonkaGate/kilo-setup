import { mkdtempSync } from "node:fs";
import { mkdir, readdir, rm, stat, writeFile } from "node:fs/promises";
import os from "node:os";
import { join } from "node:path";
import process from "node:process";
import { createNodeInstallDependencies } from "../dist/install/deps.js";
import { createKiloOracleInvocation } from "../dist/install/kilo-oracle.js";
import {
  buildManagedProviderConfig,
  formatKiloModelRef,
} from "../dist/install/managed-provider-config.js";
import { resolveManagedPaths } from "../dist/install/paths.js";
import { resolveDurableLocalKiloConfig } from "../dist/install/verify-layers.js";
import { tryParseJsoncObject } from "../dist/install/jsonc.js";
import {
  KILO_INVESTIGATED_VERSION,
  KILO_PACKAGE_NAME,
} from "../dist/install/kilo.js";

const kiloCommand = process.argv[2];
const supportedCommands = new Set(["kilo", "kilocode"]);

if (!supportedCommands.has(kiloCommand)) {
  console.error(
    "Usage: node scripts/run-kilo-oracle-proof.mjs <kilo|kilocode>",
  );
  process.exit(1);
}

const fixtureRoot = mkdtempSync(join(os.tmpdir(), "kilo-oracle-proof-"));
const originalHomeDir = join(fixtureRoot, "fixture-home");
const originalProjectRoot = join(fixtureRoot, "fixture-project");
const sandboxRoot = join(fixtureRoot, "sandbox");
const managedPaths = resolveManagedPaths(
  originalHomeDir,
  originalProjectRoot,
  process.platform,
);
const selectedModelKey = "qwen3-235b-a22b-instruct-2507-fp8";
const selectedModelRef = formatKiloModelRef(selectedModelKey);

try {
  await seedFixtureFiles();

  const dependencies = createNodeInstallDependencies({
    runtime: {
      cwd: originalProjectRoot,
      env: {
        ...process.env,
        KILO_CONFIG: join(fixtureRoot, "overrides", "kilo.json"),
        KILO_CONFIG_CONTENT: '{ "permission": { "bash": "allow" } }',
        KILO_CONFIG_DIR: join(fixtureRoot, "config-dir"),
      },
      homeDir: originalHomeDir,
      platform: process.platform,
    },
  });
  const verificationRequest = {
    managedPaths,
    model: selectedModelKey,
    projectRoot: originalProjectRoot,
    providerId: "gonkagate",
    scope: "project",
  };
  const durableResolution = await resolveDurableLocalKiloConfig(
    verificationRequest,
    dependencies,
  );
  const invocation = await createKiloOracleInvocation(
    {
      commandName: kiloCommand,
      layers: durableResolution.layers,
      managedPaths,
      projectRoot: originalProjectRoot,
      sandboxRoot,
    },
    dependencies,
  );
  const realPathSnapshotsBefore = await captureRealPathSnapshots();
  const oracleOutput = await runOracleInvocation(invocation, dependencies);
  const parsedOutput = tryParseJsoncObject(oracleOutput);

  if (!parsedOutput.ok) {
    throw new Error(
      `Sandbox oracle output was not valid JSON/JSONC: ${parsedOutput.error.reason}`,
    );
  }

  if (parsedOutput.value.model !== selectedModelRef) {
    throw new Error(
      `Sandbox oracle resolved model mismatch. Expected ${selectedModelRef}.`,
    );
  }

  const realPathSnapshotsAfter = await captureRealPathSnapshots();
  const changedRealPaths = diffSnapshots(
    realPathSnapshotsBefore,
    realPathSnapshotsAfter,
  );

  if (changedRealPaths.length > 0) {
    throw new Error(
      `Sandbox oracle touched real paths outside the proof sandbox: ${changedRealPaths.join(", ")}`,
    );
  }

  console.log(
    `Sandbox oracle proof passed for ${kiloCommand} on ${process.platform}.`,
  );
} finally {
  await rm(fixtureRoot, {
    force: true,
    recursive: true,
  });
}

async function seedFixtureFiles() {
  await mkdir(join(originalHomeDir, ".config", "kilo"), {
    recursive: true,
  });
  await mkdir(join(originalProjectRoot, ".kilo"), {
    recursive: true,
  });
  await mkdir(join(fixtureRoot, "overrides"), {
    recursive: true,
  });
  await mkdir(join(fixtureRoot, "config-dir"), {
    recursive: true,
  });

  await writeFile(
    join(originalHomeDir, ".config", "kilo", "kilo.jsonc"),
    `${JSON.stringify(
      {
        provider: {
          gonkagate: buildManagedProviderConfig(selectedModelKey),
        },
      },
      null,
      2,
    )}\n`,
    "utf8",
  );
  await writeFile(
    join(originalProjectRoot, ".kilo", "kilo.jsonc"),
    `${JSON.stringify(
      {
        model: selectedModelRef,
      },
      null,
      2,
    )}\n`,
    "utf8",
  );
  await writeFile(
    join(fixtureRoot, "overrides", "kilo.json"),
    '{ "theme": "proof" }\n',
    "utf8",
  );
  await writeFile(
    join(fixtureRoot, "config-dir", "kilo.jsonc"),
    '{ "permission": { "bash": "deny" } }\n',
    "utf8",
  );
}

async function captureRealPathSnapshots() {
  const snapshots = new Map();

  for (const candidate of collectRealPathCandidates()) {
    snapshots.set(candidate, await snapshotPath(candidate));
  }

  return snapshots;
}

async function runOracleInvocation(invocation, dependencies) {
  const packageInvocation = {
    ...invocation,
    command: "npm",
    args: [
      "exec",
      "--yes",
      "--package",
      `${KILO_PACKAGE_NAME}@${KILO_INVESTIGATED_VERSION}`,
      "--",
      kiloCommand,
      "debug",
      "config",
    ],
  };
  const packageAttempt = await executeOracleInvocation(
    packageInvocation,
    dependencies,
  );

  if (packageAttempt.ok) {
    return packageAttempt.stdout;
  }

  throw new Error(
    `Sandbox oracle package invocation failed. ${formatOracleFailure("package", packageAttempt)}`,
  );
}

async function executeOracleInvocation(invocation, dependencies) {
  try {
    const result = await dependencies.commands.run(
      invocation.command,
      invocation.args,
      {
        cwd: invocation.cwd,
        env: invocation.env,
      },
    );

    if (result.exitCode !== 0) {
      return {
        args: invocation.args,
        command: invocation.command,
        exitCode: result.exitCode,
        ok: false,
        signal: result.signal,
        stderrLength: result.stderr.length,
      };
    }

    return {
      ok: true,
      stdout: result.stdout,
    };
  } catch (error) {
    return {
      args: invocation.args,
      command: invocation.command,
      error,
      ok: false,
    };
  }
}

function formatOracleFailure(label, attempt) {
  if ("error" in attempt) {
    return `${label} invocation ${attempt.command} ${attempt.args.join(" ")} threw ${String(attempt.error)}.`;
  }

  return `${label} invocation ${attempt.command} ${attempt.args.join(" ")} failed with exit code ${attempt.exitCode}${attempt.signal ? ` and signal ${attempt.signal}` : ""}. stderr length=${attempt.stderrLength}.`;
}

function collectRealPathCandidates() {
  const actualHomeDir = os.homedir();
  const candidates = new Set([
    join(actualHomeDir, ".config", "kilo"),
    join(actualHomeDir, ".local", "share", "kilo"),
    join(actualHomeDir, ".cache", "kilo"),
    join(actualHomeDir, ".local", "state", "kilo"),
    join(actualHomeDir, ".gonkagate", "kilo"),
  ]);

  if (process.env.ProgramData) {
    candidates.add(join(process.env.ProgramData, "kilo"));
  }

  if (process.env.APPDATA) {
    candidates.add(join(process.env.APPDATA, "kilo"));
  }

  if (process.env.LOCALAPPDATA) {
    candidates.add(join(process.env.LOCALAPPDATA, "kilo"));
    candidates.add(join(process.env.LOCALAPPDATA, "npm-cache"));
  }

  if (process.env.npm_config_cache) {
    candidates.add(process.env.npm_config_cache);
  }

  for (const tempRoot of [process.env.TEMP, process.env.TMP, os.tmpdir()]) {
    if (tempRoot) {
      candidates.add(tempRoot);
    }
  }

  return [...candidates].sort();
}

async function snapshotPath(path) {
  try {
    const stats = await stat(path);

    if (!stats.isDirectory()) {
      return `file:${stats.size}:${stats.mtimeMs}`;
    }

    const filteredEntries = await snapshotDirectory(path, {
      includeAll: !isTempRoot(path),
    });

    return `dir:${JSON.stringify(filteredEntries)}`;
  } catch (error) {
    if (error && typeof error === "object" && error.code === "ENOENT") {
      return "missing";
    }

    throw error;
  }
}

async function snapshotDirectory(directoryPath, options) {
  const entries = await readdir(directoryPath, {
    withFileTypes: true,
  });
  const serializedEntries = [];

  for (const entry of entries) {
    if (!options.includeAll && !/(gonkagate|kilo|npm)/iu.test(entry.name)) {
      continue;
    }

    const fullPath = join(directoryPath, entry.name);
    const stats = await stat(fullPath);
    serializedEntries.push(
      `${entry.name}:${entry.isDirectory() ? "dir" : "file"}:${stats.size}:${stats.mtimeMs}`,
    );
  }

  return serializedEntries.sort();
}

function isTempRoot(path) {
  const tempRoots = new Set(
    [process.env.TEMP, process.env.TMP, os.tmpdir()].filter(Boolean),
  );

  return tempRoots.has(path);
}

function diffSnapshots(before, after) {
  const changed = [];

  for (const [path, valueBefore] of before.entries()) {
    const valueAfter = after.get(path);

    if (valueAfter !== valueBefore) {
      changed.push(path);
    }
  }

  return changed;
}
