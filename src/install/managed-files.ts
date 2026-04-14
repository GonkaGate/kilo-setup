import { createHash } from "node:crypto";
import type {
  ChangedManagedArtifactWriteResult,
  ManagedArtifactWriteResult,
} from "./contracts/managed-artifact.js";
import type { InstallDependencies } from "./deps.js";
import {
  getInstallPathApi,
  isPathInside,
  normalizeInstallPath,
} from "./platform-path.js";

export const POSIX_MANAGED_DIRECTORY_MODE = 0o700;
export const POSIX_MANAGED_FILE_MODE = 0o600;

export type ManagedFileProtectionStrategy =
  | {
      directoryMode: number;
      fileMode: number;
      kind: "posix_owner_only";
    }
  | {
      homeDirectory: string;
      kind: "windows_profile_inheritance";
    };

export function formatBackupTimestamp(date: Date): string {
  return date
    .toISOString()
    .replaceAll("-", "")
    .replaceAll(":", "")
    .replace(/\.\d{3}Z$/u, "Z");
}

export function supportsOwnerOnlyPermissions(
  dependencies: Pick<InstallDependencies, "runtime">,
): boolean {
  return dependencies.runtime.platform !== "win32";
}

export function resolveManagedFileProtectionStrategy(
  dependencies: Pick<InstallDependencies, "runtime">,
): ManagedFileProtectionStrategy {
  if (supportsOwnerOnlyPermissions(dependencies)) {
    return {
      directoryMode: POSIX_MANAGED_DIRECTORY_MODE,
      fileMode: POSIX_MANAGED_FILE_MODE,
      kind: "posix_owner_only",
    };
  }

  return {
    homeDirectory: normalizeInstallPath(
      dependencies.runtime.homeDir,
      dependencies.runtime.platform,
    ),
    kind: "windows_profile_inheritance",
  };
}

export function assertUserProfileScopedManagedPath(
  dependencies: Pick<InstallDependencies, "runtime">,
  targetPath: string,
): void {
  const protectionStrategy = resolveManagedFileProtectionStrategy(dependencies);

  if (protectionStrategy.kind !== "windows_profile_inheritance") {
    return;
  }

  if (
    isPathInside(
      protectionStrategy.homeDirectory,
      targetPath,
      dependencies.runtime.platform,
    )
  ) {
    return;
  }

  throw new Error(
    "Windows-managed user files must stay inside the current user's profile directory.",
  );
}

export async function ensureManagedDirectory(
  dependencies: InstallDependencies,
  targetPath: string,
): Promise<string> {
  const protectionStrategy = resolveManagedFileProtectionStrategy(dependencies);
  const pathApi = getInstallPathApi(dependencies.runtime.platform);
  const normalizedTargetPath = normalizeInstallPath(
    targetPath,
    dependencies.runtime.platform,
  );
  const directoryPath = pathApi.dirname(normalizedTargetPath);

  assertUserProfileScopedManagedPath(dependencies, normalizedTargetPath);
  await dependencies.fs.mkdir(directoryPath, {
    recursive: true,
  });

  if (protectionStrategy.kind === "posix_owner_only") {
    await dependencies.fs.chmod(
      directoryPath,
      protectionStrategy.directoryMode,
    );
  }

  return directoryPath;
}

export async function ensureManagedFileProtection(
  dependencies: InstallDependencies,
  targetPath: string,
): Promise<void> {
  const protectionStrategy = resolveManagedFileProtectionStrategy(dependencies);
  const normalizedTargetPath = normalizeInstallPath(
    targetPath,
    dependencies.runtime.platform,
  );

  await ensureManagedDirectory(dependencies, normalizedTargetPath);

  if (protectionStrategy.kind !== "posix_owner_only") {
    return;
  }

  if (!(await dependencies.fs.pathExists(normalizedTargetPath))) {
    return;
  }

  await dependencies.fs.chmod(
    normalizedTargetPath,
    protectionStrategy.fileMode,
  );
}

export async function createTimestampedBackup(
  dependencies: InstallDependencies,
  targetPath: string,
  backupDirectoryPath: string,
): Promise<string> {
  const protectionStrategy = resolveManagedFileProtectionStrategy(dependencies);
  const pathApi = getInstallPathApi(dependencies.runtime.platform);
  const normalizedTargetPath = normalizeInstallPath(
    targetPath,
    dependencies.runtime.platform,
  );
  const normalizedBackupDirectoryPath = normalizeInstallPath(
    backupDirectoryPath,
    dependencies.runtime.platform,
  );
  const backupPath = pathApi.join(
    normalizedBackupDirectoryPath,
    formatBackupFileName(
      normalizedTargetPath,
      dependencies.clock.now(),
      dependencies.runtime.platform,
    ),
  );
  const existingContents = await dependencies.fs.readFile(
    normalizedTargetPath,
    "utf8",
  );

  await ensureManagedDirectory(dependencies, backupPath);
  await dependencies.fs.writeFile(backupPath, existingContents, {
    encoding: "utf8",
  });

  if (protectionStrategy.kind === "posix_owner_only") {
    await dependencies.fs.chmod(backupPath, protectionStrategy.fileMode);
  }

  return backupPath;
}

export async function writeManagedTextFile(
  dependencies: InstallDependencies,
  targetPath: string,
  contents: string,
): Promise<void> {
  const protectionStrategy = resolveManagedFileProtectionStrategy(dependencies);
  const normalizedTargetPath = normalizeInstallPath(
    targetPath,
    dependencies.runtime.platform,
  );

  await ensureManagedDirectory(dependencies, normalizedTargetPath);

  await dependencies.fs.writeFileAtomic(normalizedTargetPath, contents, {
    encoding: "utf8",
    mode:
      protectionStrategy.kind === "posix_owner_only"
        ? protectionStrategy.fileMode
        : undefined,
  });

  if (protectionStrategy.kind === "posix_owner_only") {
    await dependencies.fs.chmod(
      normalizedTargetPath,
      protectionStrategy.fileMode,
    );
  }
}

export interface ManagedTextArtifactWriteRequest<
  TResult extends ChangedManagedArtifactWriteResult =
    ChangedManagedArtifactWriteResult,
> {
  backupDirectoryPath?: string;
  contents: string;
  mapBackupError: (cause: unknown) => Error;
  mapWriteError: (cause: unknown) => Error;
  path: string;
  toWriteResult?: (result: ChangedManagedArtifactWriteResult) => TResult;
}

export async function replaceManagedTextFile<
  TResult extends ChangedManagedArtifactWriteResult =
    ChangedManagedArtifactWriteResult,
>(
  request: ManagedTextArtifactWriteRequest<TResult>,
  dependencies: InstallDependencies,
): Promise<TResult> {
  const normalizedPath = normalizeInstallPath(
    request.path,
    dependencies.runtime.platform,
  );
  const existedBefore = await dependencies.fs.pathExists(normalizedPath);

  if (existedBefore) {
    let backupPath: string;
    const pathApi = getInstallPathApi(dependencies.runtime.platform);

    try {
      backupPath = await createTimestampedBackup(
        dependencies,
        normalizedPath,
        request.backupDirectoryPath ?? pathApi.dirname(normalizedPath),
      );
    } catch (cause) {
      throw request.mapBackupError(cause);
    }

    try {
      await writeManagedTextFile(
        dependencies,
        normalizedPath,
        request.contents,
      );
    } catch (cause) {
      throw request.mapWriteError(cause);
    }

    const result: ChangedManagedArtifactWriteResult = {
      backupPath,
      changed: true,
      created: false,
      path: normalizedPath,
      rollbackAction: {
        backupPath,
        kind: "restore_backup",
        path: normalizedPath,
      },
    };

    return request.toWriteResult === undefined
      ? (result as TResult)
      : request.toWriteResult(result);
  }

  try {
    await writeManagedTextFile(dependencies, normalizedPath, request.contents);
  } catch (cause) {
    throw request.mapWriteError(cause);
  }

  const result: ChangedManagedArtifactWriteResult = {
    backupPath: undefined,
    changed: true,
    created: true,
    path: normalizedPath,
    rollbackAction: {
      kind: "delete_created_file",
      path: normalizedPath,
    },
  };

  return request.toWriteResult === undefined
    ? (result as TResult)
    : request.toWriteResult(result);
}

function formatBackupFileName(
  targetPath: string,
  now: Date,
  platform: NodeJS.Platform,
): string {
  const pathApi = getInstallPathApi(platform);
  const baseName = pathApi.basename(targetPath);
  const pathHash = createHash("sha256")
    .update(targetPath)
    .digest("hex")
    .slice(0, 12);

  return `${baseName}.${pathHash}.${formatBackupTimestamp(now)}.bak`;
}
