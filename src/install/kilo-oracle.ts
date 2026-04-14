import type { KiloCommandName } from "./contracts.js";
import type { InstallDependencies } from "./deps.js";
import { createInstallError } from "./errors.js";
import {
  KILO_CONFIG_DIR_ENV_VAR,
  KILO_CONFIG_ENV_VAR,
  KILO_INVESTIGATED_VERSION,
  KILO_PACKAGE_NAME,
  KILO_TEST_MANAGED_CONFIG_DIR_ENV_VAR,
} from "./kilo.js";
import type { ManagedPaths } from "./paths.js";
import type { EffectiveConfigVerificationLayerSnapshot } from "./contracts/effective-config.js";
import {
  getInstallPathApi,
  isPathInside,
  normalizeInstallPath,
} from "./platform-path.js";

const FAKE_SECRET_VALUE = "gp-fake-kilo-oracle-secret";
const ORACLE_MACHINE_ID = "kilo-setup-oracle-machine";

export interface KiloOracleRequest {
  commandName: KiloCommandName;
  managedPaths: ManagedPaths;
  projectRoot: string;
  sandboxRoot: string;
  layers: readonly EffectiveConfigVerificationLayerSnapshot[];
}

export interface KiloOracleInvocation {
  args: readonly string[];
  command: string;
  cwd: string;
  env: NodeJS.ProcessEnv;
  sandboxRoot: string;
}

export async function createKiloOracleInvocation(
  request: KiloOracleRequest,
  dependencies: InstallDependencies,
): Promise<KiloOracleInvocation> {
  const layout = createKiloOracleSandboxLayout(
    request.sandboxRoot,
    dependencies.runtime.platform,
  );
  const mappedKiloConfigPath = dependencies.runtime.env[KILO_CONFIG_ENV_VAR]
    ? mapLayerPathToSandbox(
        normalizeInstallPath(
          dependencies.runtime.env[KILO_CONFIG_ENV_VAR] ?? "",
          dependencies.runtime.platform,
        ),
        "KILO_CONFIG",
        {
          layout,
          originalHomeDir: dependencies.runtime.homeDir,
          originalProjectRoot: request.projectRoot,
          originalConfigDir: dependencies.runtime.env[KILO_CONFIG_DIR_ENV_VAR],
          platform: dependencies.runtime.platform,
        },
      )
    : undefined;
  const mappedKiloConfigDir = dependencies.runtime.env[KILO_CONFIG_DIR_ENV_VAR]
    ? layout.configDirOverride
    : undefined;

  for (const layer of request.layers) {
    if (layer.source.kind !== "file") {
      continue;
    }

    const targetPath = mapLayerPathToSandbox(
      layer.source.path,
      layer.source.layer,
      {
        layout,
        originalHomeDir: dependencies.runtime.homeDir,
        originalProjectRoot: request.projectRoot,
        originalConfigDir: dependencies.runtime.env[KILO_CONFIG_DIR_ENV_VAR],
        platform: dependencies.runtime.platform,
      },
    );

    await writeSandboxFile(
      dependencies,
      targetPath,
      JSON.stringify(layer.config, null, 2) + "\n",
    );
  }

  await writeSandboxFile(
    dependencies,
    layout.managedPaths.secretPath,
    `${FAKE_SECRET_VALUE}\n`,
  );

  return {
    args: [
      "exec",
      "--yes",
      "--package",
      `${KILO_PACKAGE_NAME}@${KILO_INVESTIGATED_VERSION}`,
      "--",
      request.commandName,
      "debug",
      "config",
    ],
    command: "npm",
    cwd: layout.projectRoot,
    env: createKiloOracleEnvironment(
      dependencies.runtime.env,
      dependencies.runtime.platform,
      layout,
      {
        kiloConfigDir: mappedKiloConfigDir,
        kiloConfigPath: mappedKiloConfigPath,
      },
    ),
    sandboxRoot: request.sandboxRoot,
  };
}

export async function runKiloOracle(
  request: KiloOracleRequest,
  dependencies: InstallDependencies,
): Promise<string> {
  const invocation = await createKiloOracleInvocation(request, dependencies);

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
      throw createInstallError("effective_config_oracle_command_failed", {
        args: invocation.args,
        command: invocation.command,
        exitCode: result.exitCode,
        signal: result.signal,
      });
    }

    return result.stdout;
  } catch (error) {
    if (
      error instanceof Error &&
      "code" in error &&
      (error as { code?: string }).code ===
        "effective_config_oracle_command_failed"
    ) {
      throw error;
    }

    throw createInstallError("effective_config_oracle_command_failed", {
      args: invocation.args,
      cause: error,
      command: invocation.command,
    });
  }
}

interface KiloOracleSandboxLayout {
  cacheDir: string;
  configDir: string;
  configDirOverride: string;
  dataDir: string;
  homeDir: string;
  managedPaths: ManagedPaths;
  npmCacheDir: string;
  projectRoot: string;
  stateDir: string;
  tempDir: string;
  testManagedConfigDir: string;
}

interface KiloOraclePathMappingContext {
  layout: KiloOracleSandboxLayout;
  originalConfigDir?: string;
  originalHomeDir: string;
  originalProjectRoot: string;
  platform: NodeJS.Platform;
}

function createKiloOracleSandboxLayout(
  sandboxRoot: string,
  platform: NodeJS.Platform,
): KiloOracleSandboxLayout {
  const pathApi = getInstallPathApi(platform);
  const normalizedSandboxRoot = normalizeInstallPath(sandboxRoot, platform);
  const homeDir = pathApi.join(normalizedSandboxRoot, "home");
  const projectRoot = pathApi.join(
    normalizedSandboxRoot,
    "workspace",
    "project",
  );
  const configDir = pathApi.join(normalizedSandboxRoot, "xdg", "config");
  const dataDir = pathApi.join(normalizedSandboxRoot, "xdg", "data");
  const cacheDir = pathApi.join(normalizedSandboxRoot, "xdg", "cache");
  const stateDir = pathApi.join(normalizedSandboxRoot, "xdg", "state");
  const tempDir = pathApi.join(normalizedSandboxRoot, "tmp");

  return {
    cacheDir,
    configDir,
    configDirOverride: pathApi.join(normalizedSandboxRoot, "config-dir"),
    dataDir,
    homeDir,
    managedPaths: {
      installStatePath: pathApi.join(
        homeDir,
        ".gonkagate",
        "kilo",
        "install-state.json",
      ),
      managedRootDirectory: pathApi.join(homeDir, ".gonkagate", "kilo"),
      projectConfigBackupDirectory: pathApi.join(
        homeDir,
        ".gonkagate",
        "kilo",
        "backups",
        "project-config",
      ),
      projectConfigDefaultPath: pathApi.join(
        projectRoot,
        ".kilo",
        "kilo.jsonc",
      ),
      secretPath: pathApi.join(homeDir, ".gonkagate", "kilo", "api-key"),
      userConfigBackupDirectory: pathApi.join(
        homeDir,
        ".gonkagate",
        "kilo",
        "backups",
        "user-config",
      ),
      userConfigDefaultPath: pathApi.join(
        homeDir,
        ".config",
        "kilo",
        "kilo.jsonc",
      ),
    },
    npmCacheDir: pathApi.join(normalizedSandboxRoot, "npm-cache"),
    projectRoot,
    stateDir,
    tempDir,
    testManagedConfigDir: pathApi.join(normalizedSandboxRoot, "managed-config"),
  };
}

function createKiloOracleEnvironment(
  env: NodeJS.ProcessEnv,
  platform: NodeJS.Platform,
  layout: KiloOracleSandboxLayout,
  overrides: {
    kiloConfigDir?: string;
    kiloConfigPath?: string;
  },
): NodeJS.ProcessEnv {
  const nextEnv = { ...env };

  delete nextEnv.KILO_CONFIG_CONTENT;

  nextEnv.HOME = layout.homeDir;
  nextEnv.XDG_CONFIG_HOME = layout.configDir;
  nextEnv.XDG_DATA_HOME = layout.dataDir;
  nextEnv.XDG_CACHE_HOME = layout.cacheDir;
  nextEnv.XDG_STATE_HOME = layout.stateDir;
  nextEnv.npm_config_cache = layout.npmCacheDir;
  nextEnv.KILO_TELEMETRY_LEVEL = "off";
  nextEnv.KILO_MACHINE_ID = ORACLE_MACHINE_ID;
  nextEnv.KILO_DISABLE_MODELS_FETCH = "1";
  nextEnv.KILO_DISABLE_LSP_DOWNLOAD = "1";
  nextEnv.KILO_DISABLE_DEFAULT_PLUGINS = "1";
  nextEnv.KILO_DISABLE_CLAUDE_CODE = "1";
  nextEnv[KILO_TEST_MANAGED_CONFIG_DIR_ENV_VAR] = layout.testManagedConfigDir;
  nextEnv.TMP = layout.tempDir;
  nextEnv.TEMP = layout.tempDir;

  if (overrides.kiloConfigPath !== undefined) {
    nextEnv[KILO_CONFIG_ENV_VAR] = overrides.kiloConfigPath;
  } else {
    delete nextEnv[KILO_CONFIG_ENV_VAR];
  }

  if (overrides.kiloConfigDir !== undefined) {
    nextEnv[KILO_CONFIG_DIR_ENV_VAR] = overrides.kiloConfigDir;
  } else {
    delete nextEnv[KILO_CONFIG_DIR_ENV_VAR];
  }

  if (platform === "win32") {
    const pathApi = getInstallPathApi(platform);
    const parsedHome = pathApi.parse(layout.homeDir);

    nextEnv.USERPROFILE = layout.homeDir;
    nextEnv.HOMEDRIVE = parsedHome.root.replace(/[\\/]+$/u, "");
    nextEnv.HOMEPATH = layout.homeDir.slice(parsedHome.root.length - 1);
  }

  return nextEnv;
}

function mapLayerPathToSandbox(
  originalPath: string,
  layer: KiloOracleRequest["layers"][number]["source"]["layer"],
  context: KiloOraclePathMappingContext,
): string {
  const pathApi = getInstallPathApi(context.platform);
  const normalizedOriginalPath = normalizeInstallPath(
    originalPath,
    context.platform,
  );
  const normalizedHomeDir = normalizeInstallPath(
    context.originalHomeDir,
    context.platform,
  );
  const normalizedProjectRoot = normalizeInstallPath(
    context.originalProjectRoot,
    context.platform,
  );
  const normalizedConfigDir =
    context.originalConfigDir === undefined
      ? undefined
      : normalizeInstallPath(context.originalConfigDir, context.platform);

  if (layer === "KILO_CONFIG") {
    return pathApi.join(
      context.layout.configDir,
      "env",
      pathApi.basename(normalizedOriginalPath),
    );
  }

  if (
    layer === "KILO_CONFIG_DIR" &&
    normalizedConfigDir !== undefined &&
    isPathInside(normalizedConfigDir, normalizedOriginalPath, context.platform)
  ) {
    return pathApi.join(
      context.layout.configDirOverride,
      pathApi.relative(normalizedConfigDir, normalizedOriginalPath),
    );
  }

  if (layer === "global_config") {
    // The sandbox sets XDG_CONFIG_HOME, so mirrored global config must live
    // under that tree for `kilo debug config` to load the same layer.
    return pathApi.join(
      context.layout.configDir,
      "kilo",
      pathApi.basename(normalizedOriginalPath),
    );
  }

  if (layer === "system_managed_config") {
    return pathApi.join(
      context.layout.testManagedConfigDir,
      pathApi.basename(normalizedOriginalPath),
    );
  }

  if (
    isPathInside(
      normalizedProjectRoot,
      normalizedOriginalPath,
      context.platform,
    )
  ) {
    return pathApi.join(
      context.layout.projectRoot,
      pathApi.relative(normalizedProjectRoot, normalizedOriginalPath),
    );
  }

  if (
    isPathInside(normalizedHomeDir, normalizedOriginalPath, context.platform)
  ) {
    return pathApi.join(
      context.layout.homeDir,
      pathApi.relative(normalizedHomeDir, normalizedOriginalPath),
    );
  }

  return pathApi.join(
    context.layout.configDir,
    "mirrors",
    layer,
    pathApi.basename(normalizedOriginalPath),
  );
}

async function writeSandboxFile(
  dependencies: InstallDependencies,
  path: string,
  contents: string,
): Promise<void> {
  const pathApi = getInstallPathApi(dependencies.runtime.platform);

  await dependencies.fs.mkdir(pathApi.dirname(path), {
    recursive: true,
  });
  await dependencies.fs.writeFile(path, contents, {
    encoding: "utf8",
  });
}
