import assert from "node:assert/strict";
import test from "node:test";
import {
  detectInstalledKilo,
  parseKiloVersion,
  resolveSupportedKiloProfile,
} from "../../src/install/kilo.js";
import { createTestInstallDependencies } from "./test-deps.js";

test("parseKiloVersion extracts semver from kilo --version output", () => {
  assert.equal(parseKiloVersion("kilo 7.2.0"), "7.2.0");
  assert.equal(parseKiloVersion("kilocode version 7.2.14"), "7.2.14");
  assert.equal(parseKiloVersion("version unknown"), null);
});

test("resolveSupportedKiloProfile accepts versions at or above the 7.2.0 floor", () => {
  const profile = resolveSupportedKiloProfile("7.2.0");

  assert.equal(profile?.id, "kilo_cli_7_2_plus");
  assert.equal(resolveSupportedKiloProfile("7.2.14")?.id, "kilo_cli_7_2_plus");
  assert.equal(resolveSupportedKiloProfile("7.5.0")?.id, "kilo_cli_7_2_plus");
  assert.equal(
    resolveSupportedKiloProfile("7.2.1-rc.202604092126")?.id,
    "kilo_cli_7_2_plus",
  );
  assert.equal(resolveSupportedKiloProfile("7.1.23"), undefined);
});

test("detectInstalledKilo accepts kilo 7.2.0", async () => {
  const detection = await detectInstalledKilo(
    createTestInstallDependencies({
      "kilo --version": {
        kind: "result",
        result: {
          exitCode: 0,
          signal: null,
          stderr: "",
          stdout: "kilo 7.2.0",
        },
      },
    }),
  );

  assert.equal(detection.ok, true);

  if (detection.ok) {
    assert.equal(detection.kilo.command, "kilo");
    assert.equal(detection.kilo.installedVersion, "7.2.0");
    assert.equal(detection.kilo.profileId, "kilo_cli_7_2_plus");
  }
});

test("detectInstalledKilo accepts later 7.2.x patch versions", async () => {
  const detection = await detectInstalledKilo(
    createTestInstallDependencies({
      "kilo --version": {
        kind: "result",
        result: {
          exitCode: 0,
          signal: null,
          stderr: "",
          stdout: "kilo 7.2.14",
        },
      },
    }),
  );

  assert.equal(detection.ok, true);

  if (detection.ok) {
    assert.equal(detection.kilo.command, "kilo");
    assert.equal(detection.kilo.installedVersion, "7.2.14");
    assert.equal(detection.kilo.profileId, "kilo_cli_7_2_plus");
  }
});

test("detectInstalledKilo accepts newer Kilo versions without a preset upper bound", async () => {
  const detection = await detectInstalledKilo(
    createTestInstallDependencies({
      "kilo --version": {
        kind: "result",
        result: {
          exitCode: 0,
          signal: null,
          stderr: "",
          stdout: "kilo 7.5.0",
        },
      },
    }),
  );

  assert.equal(detection.ok, true);

  if (detection.ok) {
    assert.equal(detection.kilo.command, "kilo");
    assert.equal(detection.kilo.installedVersion, "7.5.0");
    assert.equal(detection.kilo.profileId, "kilo_cli_7_2_plus");
  }
});

test("detectInstalledKilo falls back to kilocode when kilo is missing", async () => {
  const detection = await detectInstalledKilo(
    createTestInstallDependencies({
      "kilocode --version": {
        kind: "result",
        result: {
          exitCode: 0,
          signal: null,
          stderr: "",
          stdout: "kilocode 7.2.14",
        },
      },
    }),
  );

  assert.equal(detection.ok, true);

  if (detection.ok) {
    assert.equal(detection.kilo.command, "kilocode");
    assert.equal(detection.kilo.installedVersion, "7.2.14");
  }
});

test("detectInstalledKilo blocks when kilo and kilocode are both missing", async () => {
  const detection = await detectInstalledKilo(
    createTestInstallDependencies({}),
  );

  assert.equal(detection.ok, false);

  if (!detection.ok) {
    assert.equal(detection.errorCode, "kilo_not_found");
    assert.match(detection.message, /Install @kilocode\/cli >=7\.2\.0/i);
  }
});

test("detectInstalledKilo blocks versions below the 7.2.0 floor", async () => {
  const detection = await detectInstalledKilo(
    createTestInstallDependencies({
      "kilo --version": {
        kind: "result",
        result: {
          exitCode: 0,
          signal: null,
          stderr: "",
          stdout: "kilo 7.1.23",
        },
      },
    }),
  );

  assert.equal(detection.ok, false);

  if (!detection.ok) {
    assert.equal(detection.errorCode, "kilo_version_unsupported");
    assert.equal(detection.kilo?.command, "kilo");
    assert.equal(detection.kilo?.installedVersion, "7.1.23");
    assert.match(detection.message, /@kilocode\/cli >=7\.2\.0/i);
  }
});

test("detectInstalledKilo blocks malformed version output", async () => {
  const detection = await detectInstalledKilo(
    createTestInstallDependencies({
      "kilo --version": {
        kind: "result",
        result: {
          exitCode: 0,
          signal: null,
          stderr: "",
          stdout: "kilo unknown",
        },
      },
    }),
  );

  assert.equal(detection.ok, false);

  if (!detection.ok) {
    assert.equal(detection.errorCode, "kilo_version_unparseable");
  }
});

test("detectInstalledKilo treats non-zero --version as a compatibility detection blocker", async () => {
  const detection = await detectInstalledKilo(
    createTestInstallDependencies({
      "kilo --version": {
        kind: "result",
        result: {
          exitCode: 1,
          signal: null,
          stderr: "broken",
          stdout: "",
        },
      },
    }),
  );

  assert.equal(detection.ok, false);

  if (!detection.ok) {
    assert.equal(detection.errorCode, "kilo_version_unparseable");
  }
});
