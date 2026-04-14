import { CONTRACT_METADATA } from "../constants/contract.js";
import {
  isCuratedModelKey,
  isCuratedModelTransport,
} from "../constants/models.js";
import type { ManagedInstallStateRecord } from "./contracts/install-state.js";
import type { ManagedArtifactWriteResult } from "./contracts/managed-artifact.js";
import type { InstallDependencies } from "./deps.js";
import { createInstallError } from "./errors.js";
import {
  assertUserProfileScopedManagedPath,
  replaceManagedTextFile,
} from "./managed-files.js";
import type { ManagedPaths } from "./paths.js";

export type ManagedInstallStateWriteResult = ManagedArtifactWriteResult;

export async function readManagedInstallState(
  dependencies: InstallDependencies,
  managedPaths: ManagedPaths,
): Promise<ManagedInstallStateRecord | undefined> {
  assertUserProfileScopedManagedPath(
    dependencies,
    managedPaths.installStatePath,
  );

  if (!(await dependencies.fs.pathExists(managedPaths.installStatePath))) {
    return undefined;
  }

  return parseManagedInstallStateRecord(
    JSON.parse(
      await dependencies.fs.readFile(managedPaths.installStatePath, "utf8"),
    ) as unknown,
  );
}

export async function writeManagedInstallState(
  record: ManagedInstallStateRecord,
  dependencies: InstallDependencies,
  managedPaths: ManagedPaths,
): Promise<ManagedInstallStateWriteResult> {
  try {
    assertUserProfileScopedManagedPath(
      dependencies,
      managedPaths.installStatePath,
    );
  } catch (cause) {
    throw createInstallError("managed_state_write_failed", {
      cause,
      target: "managed_install_state",
    });
  }

  return await replaceManagedTextFile(
    {
      contents: serializeManagedInstallState(record),
      mapBackupError: (cause) =>
        createInstallError("managed_state_backup_failed", {
          cause,
          target: "managed_install_state",
        }),
      mapWriteError: (cause) =>
        createInstallError("managed_state_write_failed", {
          cause,
          target: "managed_install_state",
        }),
      path: managedPaths.installStatePath,
    },
    dependencies,
  );
}

export function createManagedInstallStateRecord(request: {
  configTargets: {
    project?: string;
    user: string;
  };
  currentTransport: ManagedInstallStateRecord["currentTransport"];
  kiloCommand: string;
  kiloVersion: string;
  lastDurableSetupAt: string;
  selectedModelKey: ManagedInstallStateRecord["selectedModelKey"];
  selectedScope: ManagedInstallStateRecord["selectedScope"];
}): ManagedInstallStateRecord {
  return {
    compatibilityAuditVersion: CONTRACT_METADATA.upstreamKilo.checkedAt,
    configTargets: request.configTargets,
    currentTransport: request.currentTransport,
    installerPackageName: CONTRACT_METADATA.packageName,
    installerVersion: CONTRACT_METADATA.cliVersion,
    kiloCommand: request.kiloCommand,
    kiloVersion: request.kiloVersion,
    lastDurableSetupAt: request.lastDurableSetupAt,
    selectedModelKey: request.selectedModelKey,
    selectedScope: request.selectedScope,
  };
}

function serializeManagedInstallState(
  record: ManagedInstallStateRecord,
): string {
  return `${JSON.stringify(record, null, 2)}\n`;
}

function parseManagedInstallStateRecord(
  value: unknown,
): ManagedInstallStateRecord {
  if (!isObjectRecord(value)) {
    throw new Error("Managed install state must be a JSON object.");
  }

  const configTargets = getConfigTargets(value.configTargets);
  const currentTransport = getRequiredString(value, "currentTransport");
  const installerPackageName = getRequiredString(value, "installerPackageName");
  const installerVersion = getRequiredString(value, "installerVersion");
  const kiloCommand = getRequiredString(value, "kiloCommand");
  const kiloVersion = getRequiredString(value, "kiloVersion");
  const compatibilityAuditVersion = getRequiredString(
    value,
    "compatibilityAuditVersion",
  );
  const lastDurableSetupAt = getOptionalString(value, "lastDurableSetupAt");
  const selectedModelKey = getRequiredString(value, "selectedModelKey");
  const selectedScope = getRequiredString(value, "selectedScope");

  if (!isCuratedModelTransport(currentTransport)) {
    throw new Error("Managed install state has an unknown currentTransport.");
  }

  if (!isCuratedModelKey(selectedModelKey)) {
    throw new Error("Managed install state has an unknown selectedModelKey.");
  }

  if (selectedScope !== "project" && selectedScope !== "user") {
    throw new Error("Managed install state has an unknown selectedScope.");
  }

  return {
    compatibilityAuditVersion,
    configTargets,
    currentTransport,
    installerPackageName,
    installerVersion,
    kiloCommand,
    kiloVersion,
    lastDurableSetupAt,
    selectedModelKey,
    selectedScope,
  };
}

function getConfigTargets(
  value: unknown,
): ManagedInstallStateRecord["configTargets"] {
  if (!isObjectRecord(value)) {
    throw new Error("Managed install state is missing configTargets.");
  }

  const user = getRequiredString(value, "user");
  const project = getOptionalString(value, "project");

  return project === undefined ? { user } : { project, user };
}

function getRequiredString(
  value: Record<string, unknown>,
  key: string,
): string {
  const fieldValue = value[key];

  if (typeof fieldValue !== "string") {
    throw new Error(`Managed install state is missing ${key}.`);
  }

  return fieldValue;
}

function getOptionalString(
  value: Record<string, unknown>,
  key: string,
): string | undefined {
  const fieldValue = value[key];

  return typeof fieldValue === "string" ? fieldValue : undefined;
}

function isObjectRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}
