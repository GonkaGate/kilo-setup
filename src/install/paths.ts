import type { InstallDependencies, InstallFs } from "./deps.js";
import { getInstallPathApi, normalizeInstallPath } from "./platform-path.js";
import {
  KILO_DIRECTORY_CONFIG_FILE_ORDER,
  KILO_TEST_MANAGED_CONFIG_DIR_ENV_VAR,
} from "./kilo.js";

export interface ManagedPaths {
  installStatePath: string;
  managedRootDirectory: string;
  projectConfigBackupDirectory: string;
  projectConfigDefaultPath: string;
  secretPath: string;
  userConfigBackupDirectory: string;
  userConfigDefaultPath: string;
}

export interface KiloSetupPathContract {
  globalConfig: string;
  installState: string;
  managedRootDirectory: string;
  managedSecret: string;
  projectConfig: string;
}

export interface ResolvedConfigTarget<TKind extends "project" | "user"> {
  defaultPath: string;
  kind: TKind;
  path: string;
}

export interface ProjectRootResolution {
  insideGitRepository: boolean;
  projectRoot: string;
  resolvedCwd: string;
}

const SYSTEM_MANAGED_CONFIG_FILE_NAMES = KILO_DIRECTORY_CONFIG_FILE_ORDER;
const WINDOWS_DRIVE_PATH_PATTERN = /^[A-Za-z]:[\\/]/u;
const WINDOWS_UNC_PATH_PATTERN = /^\\\\/u;
const WINDOWS_POSIX_DRIVE_PATH_PATTERN = /^\/[A-Za-z](?=\/|$)/u;

export function getKiloSetupPathContract(): KiloSetupPathContract {
  return {
    globalConfig: "~/.config/kilo/kilo.jsonc",
    installState: "~/.gonkagate/kilo/install-state.json",
    managedRootDirectory: "~/.gonkagate/kilo",
    managedSecret: "~/.gonkagate/kilo/api-key",
    projectConfig: ".kilo/kilo.jsonc",
  };
}

export function resolveInspectableSystemManagedConfigPaths(
  env: NodeJS.ProcessEnv,
  platform: NodeJS.Platform = process.platform,
): readonly string[] {
  const directoryPath = resolveSystemManagedConfigDirectory(env, platform);

  if (directoryPath === undefined) {
    return [];
  }

  const pathApi = getInstallPathApi(platform);

  return SYSTEM_MANAGED_CONFIG_FILE_NAMES.map((fileName) =>
    pathApi.join(directoryPath, fileName),
  );
}

function inferPathPlatform(...pathValues: string[]): NodeJS.Platform {
  for (const pathValue of pathValues) {
    if (
      WINDOWS_DRIVE_PATH_PATTERN.test(pathValue) ||
      WINDOWS_UNC_PATH_PATTERN.test(pathValue) ||
      WINDOWS_POSIX_DRIVE_PATH_PATTERN.test(pathValue) ||
      pathValue.includes("\\")
    ) {
      return "win32";
    }
  }

  return "linux";
}

export function resolveManagedPaths(
  homeDirectory: string,
  projectRoot: string,
  platform: NodeJS.Platform = inferPathPlatform(homeDirectory, projectRoot),
): ManagedPaths {
  const pathApi = getInstallPathApi(platform);
  const normalizedHomeDirectory = normalizeInstallPath(homeDirectory, platform);
  const normalizedProjectRoot = normalizeInstallPath(projectRoot, platform);
  const managedRootDirectory = pathApi.join(
    normalizedHomeDirectory,
    ".gonkagate",
    "kilo",
  );

  return {
    installStatePath: pathApi.join(managedRootDirectory, "install-state.json"),
    managedRootDirectory,
    projectConfigBackupDirectory: pathApi.join(
      managedRootDirectory,
      "backups",
      "project-config",
    ),
    projectConfigDefaultPath: pathApi.join(
      normalizedProjectRoot,
      ".kilo",
      "kilo.jsonc",
    ),
    secretPath: pathApi.join(managedRootDirectory, "api-key"),
    userConfigBackupDirectory: pathApi.join(
      managedRootDirectory,
      "backups",
      "user-config",
    ),
    userConfigDefaultPath: pathApi.join(
      normalizedHomeDirectory,
      ".config",
      "kilo",
      "kilo.jsonc",
    ),
  };
}

function resolveInstallCwd(
  baseCwd: string,
  platform: NodeJS.Platform,
  cwd?: string,
): string {
  const pathApi = getInstallPathApi(platform);
  const normalizedBaseCwd = normalizeInstallPath(baseCwd, platform);

  if (cwd === undefined) {
    return pathApi.resolve(normalizedBaseCwd);
  }

  const normalizedCwd = normalizeInstallPath(cwd, platform);

  return pathApi.isAbsolute(normalizedCwd)
    ? pathApi.resolve(normalizedCwd)
    : pathApi.resolve(normalizedBaseCwd, normalizedCwd);
}

export async function findNearestGitRoot(
  dependencies: Pick<InstallDependencies, "fs" | "runtime">,
  startDirectory: string,
): Promise<string | undefined> {
  const pathApi = getInstallPathApi(dependencies.runtime.platform);
  let currentDirectory = pathApi.resolve(
    normalizeInstallPath(startDirectory, dependencies.runtime.platform),
  );

  while (true) {
    if (
      await dependencies.fs.pathExists(pathApi.join(currentDirectory, ".git"))
    ) {
      return currentDirectory;
    }

    const parentDirectory = pathApi.dirname(currentDirectory);

    if (parentDirectory === currentDirectory) {
      return undefined;
    }

    currentDirectory = parentDirectory;
  }
}

export async function resolveProjectRoot(
  dependencies: Pick<InstallDependencies, "fs" | "runtime">,
  cwd?: string,
): Promise<ProjectRootResolution> {
  const resolvedCwd = resolveInstallCwd(
    dependencies.runtime.cwd,
    dependencies.runtime.platform,
    cwd,
  );
  const gitRoot = await findNearestGitRoot(dependencies, resolvedCwd);

  return {
    insideGitRepository: gitRoot !== undefined,
    projectRoot: gitRoot ?? resolvedCwd,
    resolvedCwd,
  };
}

export async function resolveUserConfigTargetPath(
  dependencies: Pick<InstallDependencies, "fs" | "runtime">,
  managedPaths: ManagedPaths,
): Promise<ResolvedConfigTarget<"user">> {
  const pathApi = getInstallPathApi(dependencies.runtime.platform);
  const userConfigDirectory = pathApi.dirname(
    managedPaths.userConfigDefaultPath,
  );
  const preferredJsoncPath = managedPaths.userConfigDefaultPath;
  const preferredJsonPath = pathApi.join(userConfigDirectory, "kilo.json");

  return {
    defaultPath: managedPaths.userConfigDefaultPath,
    kind: "user",
    path: await resolveExistingConfigPath(
      dependencies.fs,
      [preferredJsoncPath, preferredJsonPath],
      preferredJsoncPath,
    ),
  };
}

export async function resolveProjectConfigTargetPath(
  dependencies: Pick<InstallDependencies, "fs" | "runtime">,
  managedPaths: ManagedPaths,
): Promise<ResolvedConfigTarget<"project">> {
  const pathApi = getInstallPathApi(dependencies.runtime.platform);
  const projectConfigDirectory = pathApi.dirname(
    managedPaths.projectConfigDefaultPath,
  );
  const preferredJsoncPath = managedPaths.projectConfigDefaultPath;
  const preferredJsonPath = pathApi.join(projectConfigDirectory, "kilo.json");

  return {
    defaultPath: managedPaths.projectConfigDefaultPath,
    kind: "project",
    path: await resolveExistingConfigPath(
      dependencies.fs,
      [preferredJsoncPath, preferredJsonPath],
      preferredJsoncPath,
    ),
  };
}

async function resolveExistingConfigPath(
  fs: InstallFs,
  candidates: readonly string[],
  defaultPath: string,
): Promise<string> {
  for (const candidatePath of candidates) {
    if (await fs.pathExists(candidatePath)) {
      return candidatePath;
    }
  }

  return defaultPath;
}

function resolveSystemManagedConfigDirectory(
  env: NodeJS.ProcessEnv,
  platform: NodeJS.Platform,
): string | undefined {
  const sandboxOverride = env[KILO_TEST_MANAGED_CONFIG_DIR_ENV_VAR];

  if (sandboxOverride !== undefined && sandboxOverride.length > 0) {
    return normalizeInstallPath(sandboxOverride, platform);
  }

  if (platform === "darwin") {
    return "/Library/Application Support/kilo";
  }

  if (platform === "linux") {
    return "/etc/kilo";
  }

  if (platform !== "win32") {
    return undefined;
  }

  const programDataDirectory = getWindowsProgramDataDirectory(env);

  if (programDataDirectory === undefined) {
    return undefined;
  }

  return getInstallPathApi(platform).join(programDataDirectory, "kilo");
}

function getWindowsProgramDataDirectory(
  env: NodeJS.ProcessEnv,
): string | undefined {
  for (const key of [
    "ProgramData",
    "PROGRAMDATA",
    "ALLUSERSPROFILE",
  ] as const) {
    const value = env[key];

    if (value !== undefined && value.length > 0) {
      return normalizeInstallPath(value, "win32");
    }
  }

  return undefined;
}
