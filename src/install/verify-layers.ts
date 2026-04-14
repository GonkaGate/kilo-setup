import type {
  EffectiveConfigVerificationBlocker,
  EffectiveConfigVerificationBlockingLayer,
  EffectiveConfigVerificationFileBackedLayer,
  EffectiveConfigVerificationInputLayerSource,
  EffectiveConfigVerificationLayerSnapshot,
} from "./contracts/effective-config.js";
import type { InstallScope } from "./contracts.js";
import type { CuratedModelKey } from "../constants/models.js";
import type { InstallDependencies } from "./deps.js";
import { createInstallError } from "./errors.js";
import { tryParseJsoncObject } from "./jsonc.js";
import {
  KILO_CONFIG_CONTENT_ENV_VAR,
  KILO_CONFIG_DIR_ENV_VAR,
  KILO_CONFIG_ENV_VAR,
  KILO_DIRECTORY_CONFIG_FILE_ORDER,
  KILO_GLOBAL_CONFIG_FILE_ORDER,
  KILO_PROJECT_DIRECTORY_NAMES,
  KILO_PROJECT_ROOT_CONFIG_FILE_ORDER,
} from "./kilo.js";
import type { ManagedPaths } from "./paths.js";
import { resolveInspectableSystemManagedConfigPaths } from "./paths.js";
import {
  collectManagedOverlapBlockers,
  collectMissingCuratedModelEntryBlockers,
  collectProviderActivationBlockers,
  collectProviderModelFilterBlockers,
  collectProviderShapeBlockers,
  collectSecretBindingProvenanceBlockers,
} from "./verification-blockers.js";
import { createSecretBindingVerificationPolicy } from "./effective-config-policy.js";
import { formatKiloModelRef } from "./managed-provider-config.js";
import {
  getInstallPathApi,
  isPathInside,
  normalizeInstallPath,
} from "./platform-path.js";

const INSPECTABLE_LAYER_PRECEDENCE = Object.freeze({
  global_config: 0,
  KILO_CONFIG: 1,
  project_root_config: 2,
  project_directory_config: 3,
  home_directory_config: 4,
  KILO_CONFIG_DIR: 5,
  KILO_CONFIG_CONTENT: 6,
  system_managed_config: 7,
  inferred_non_local: 8,
} satisfies Record<EffectiveConfigVerificationBlockingLayer, number>);

export interface VerificationLayerInspectionRequest {
  managedPaths: ManagedPaths;
  model: CuratedModelKey;
  projectRoot: string;
  providerId: string;
  scope: InstallScope;
}

export interface LocalKiloConfigResolution {
  layers: readonly EffectiveConfigVerificationLayerSnapshot[];
  resolvedConfig: Record<string, unknown>;
}

export async function resolveDurableLocalKiloConfig(
  request: VerificationLayerInspectionRequest,
  dependencies: InstallDependencies,
): Promise<LocalKiloConfigResolution> {
  return await resolveLocalKiloConfig(
    {
      ...request,
      includeConfigContent: false,
    },
    dependencies,
  );
}

export async function resolveCurrentSessionLocalKiloConfig(
  request: VerificationLayerInspectionRequest,
  dependencies: InstallDependencies,
): Promise<LocalKiloConfigResolution> {
  return await resolveLocalKiloConfig(
    {
      ...request,
      includeConfigContent: true,
    },
    dependencies,
  );
}

export async function inspectVerificationLayers(
  request: VerificationLayerInspectionRequest,
  dependencies: InstallDependencies,
  options: {
    includeConfigContent: boolean;
  } = { includeConfigContent: false },
): Promise<readonly EffectiveConfigVerificationBlocker[]> {
  const layerSnapshots = await collectInspectableLayerSnapshots(
    request,
    dependencies,
    options.includeConfigContent,
  );
  const blockers: EffectiveConfigVerificationBlocker[] = [];
  const modelRef = formatKiloModelRef(request.model);

  for (const layerSnapshot of layerSnapshots) {
    const layerPath = getLayerSnapshotPath(layerSnapshot);
    const isManagedTargetPath = isManagedActivationOrProviderTargetPath(
      request.managedPaths,
      layerPath,
      dependencies.runtime.platform,
    );

    blockers.push(
      ...collectProviderActivationBlockers(
        layerSnapshot.config,
        layerSnapshot.source.layer,
        request.providerId,
        layerPath,
      ),
      ...collectProviderModelFilterBlockers(
        layerSnapshot.config,
        layerSnapshot.source.layer,
        {
          modelKey: request.model,
          modelRef,
          providerId: request.providerId,
        },
        layerPath,
      ),
      ...collectProviderShapeBlockers(
        layerSnapshot.config,
        layerSnapshot.source.layer,
        request.providerId,
        layerPath,
      ),
      ...collectMissingCuratedModelEntryBlockers(
        layerSnapshot.config,
        layerSnapshot.source.layer,
        {
          modelKey: request.model,
          providerId: request.providerId,
        },
        layerPath,
      ),
      ...(isManagedTargetPath
        ? []
        : collectManagedOverlapBlockers(
            layerSnapshot.config,
            layerSnapshot.source.layer,
            layerPath,
          )),
    );
  }

  return blockers;
}

export async function inspectSecretBindingVerificationLayers(
  request: VerificationLayerInspectionRequest,
  dependencies: InstallDependencies,
  options: {
    includeConfigContent: boolean;
  } = { includeConfigContent: false },
): Promise<readonly EffectiveConfigVerificationBlocker[]> {
  const layerSnapshots = await collectInspectableLayerSnapshots(
    request,
    dependencies,
    options.includeConfigContent,
  );
  const blockers: EffectiveConfigVerificationBlocker[] = [];
  const secretBindingPolicy = createSecretBindingVerificationPolicy(
    request.providerId,
  );
  let sawCanonicalUserBinding = false;

  for (const layerSnapshot of layerSnapshots) {
    const layer = layerSnapshot.source.layer;
    const path = getLayerSnapshotPath(layerSnapshot);
    const config = layerSnapshot.config;

    if (
      isManagedUserConfigPath(
        request.managedPaths,
        path,
        dependencies.runtime.platform,
      )
    ) {
      sawCanonicalUserBinding = true;
    }

    blockers.push(
      ...collectSecretBindingProvenanceBlockers(
        config,
        layer,
        secretBindingPolicy,
        path,
      ),
    );
  }

  if (!sawCanonicalUserBinding) {
    blockers.push(
      ...collectSecretBindingProvenanceBlockers(
        undefined,
        "global_config",
        secretBindingPolicy,
        request.managedPaths.userConfigDefaultPath,
      ),
    );
  }

  return blockers;
}

export function selectHighestPrecedenceInspectableBlockers(
  blockers: readonly EffectiveConfigVerificationBlocker[],
): readonly EffectiveConfigVerificationBlocker[] {
  const selectedByKey = new Map<string, EffectiveConfigVerificationBlocker>();

  for (const blocker of blockers) {
    if (blocker.layer === "inferred_non_local") {
      continue;
    }

    const currentSelection = selectedByKey.get(blocker.key);

    if (
      currentSelection === undefined ||
      getInspectableLayerPrecedence(blocker.layer) >=
        getInspectableLayerPrecedence(currentSelection.layer)
    ) {
      selectedByKey.set(blocker.key, blocker);
    }
  }

  return [...selectedByKey.values()].sort((left, right) => {
    const precedenceDelta =
      getInspectableLayerPrecedence(right.layer) -
      getInspectableLayerPrecedence(left.layer);

    if (precedenceDelta !== 0) {
      return precedenceDelta;
    }

    return left.key.localeCompare(right.key);
  });
}

async function resolveLocalKiloConfig(
  request: VerificationLayerInspectionRequest & {
    includeConfigContent: boolean;
  },
  dependencies: InstallDependencies,
): Promise<LocalKiloConfigResolution> {
  const layers = await collectInspectableLayerSnapshots(
    request,
    dependencies,
    request.includeConfigContent,
  );
  let resolvedConfig: Record<string, unknown> = {};

  for (const layer of layers) {
    resolvedConfig = mergeConfigObjects(resolvedConfig, layer.config);
  }

  return {
    layers,
    resolvedConfig,
  };
}

async function collectInspectableLayerSnapshots(
  request: VerificationLayerInspectionRequest,
  dependencies: InstallDependencies,
  includeConfigContent: boolean,
): Promise<readonly EffectiveConfigVerificationLayerSnapshot[]> {
  const pathApi = getInstallPathApi(dependencies.runtime.platform);
  const normalizedHomeDir = normalizeInstallPath(
    dependencies.runtime.homeDir,
    dependencies.runtime.platform,
  );
  const normalizedProjectRoot = normalizeInstallPath(
    request.projectRoot,
    dependencies.runtime.platform,
  );
  const snapshots: EffectiveConfigVerificationLayerSnapshot[] = [];

  for (const fileName of KILO_GLOBAL_CONFIG_FILE_ORDER) {
    const path = pathApi.join(normalizedHomeDir, ".config", "kilo", fileName);
    const snapshot = await maybeReadLayerFromFile(
      {
        kind: "file",
        layer: "global_config",
        path,
      },
      dependencies,
    );

    if (snapshot !== undefined) {
      snapshots.push(snapshot);
    }
  }

  const kiloConfigPath = dependencies.runtime.env[KILO_CONFIG_ENV_VAR];

  if (kiloConfigPath !== undefined && kiloConfigPath.length > 0) {
    const snapshot = await maybeReadLayerFromFile(
      {
        kind: "file",
        layer: "KILO_CONFIG",
        path: normalizeInstallPath(
          kiloConfigPath,
          dependencies.runtime.platform,
        ),
      },
      dependencies,
    );

    if (snapshot !== undefined) {
      snapshots.push(snapshot);
    }
  }

  for (const fileName of KILO_PROJECT_ROOT_CONFIG_FILE_ORDER) {
    const snapshot = await maybeReadLayerFromFile(
      {
        kind: "file",
        layer: "project_root_config",
        path: pathApi.join(normalizedProjectRoot, fileName),
      },
      dependencies,
    );

    if (snapshot !== undefined) {
      snapshots.push(snapshot);
    }
  }

  for (const directoryPath of resolveProjectTreeSearchRoots(
    normalizedProjectRoot,
    normalizeInstallPath(
      dependencies.runtime.cwd,
      dependencies.runtime.platform,
    ),
    dependencies.runtime.platform,
  )) {
    for (const directoryName of KILO_PROJECT_DIRECTORY_NAMES) {
      for (const fileName of KILO_DIRECTORY_CONFIG_FILE_ORDER) {
        const snapshot = await maybeReadLayerFromFile(
          {
            kind: "file",
            layer: "project_directory_config",
            path: pathApi.join(directoryPath, directoryName, fileName),
          },
          dependencies,
        );

        if (snapshot !== undefined) {
          snapshots.push(snapshot);
        }
      }
    }
  }

  for (const directoryName of KILO_PROJECT_DIRECTORY_NAMES) {
    for (const fileName of KILO_DIRECTORY_CONFIG_FILE_ORDER) {
      const snapshot = await maybeReadLayerFromFile(
        {
          kind: "file",
          layer: "home_directory_config",
          path: pathApi.join(normalizedHomeDir, directoryName, fileName),
        },
        dependencies,
      );

      if (snapshot !== undefined) {
        snapshots.push(snapshot);
      }
    }
  }

  const kiloConfigDirectory = dependencies.runtime.env[KILO_CONFIG_DIR_ENV_VAR];

  if (kiloConfigDirectory !== undefined && kiloConfigDirectory.length > 0) {
    const normalizedConfigDirectory = normalizeInstallPath(
      kiloConfigDirectory,
      dependencies.runtime.platform,
    );

    for (const fileName of KILO_DIRECTORY_CONFIG_FILE_ORDER) {
      const snapshot = await maybeReadLayerFromFile(
        {
          kind: "file",
          layer: "KILO_CONFIG_DIR",
          path: pathApi.join(normalizedConfigDirectory, fileName),
        },
        dependencies,
      );

      if (snapshot !== undefined) {
        snapshots.push(snapshot);
      }
    }
  }

  if (includeConfigContent) {
    const inlineContents =
      dependencies.runtime.env[KILO_CONFIG_CONTENT_ENV_VAR];

    if (inlineContents !== undefined) {
      snapshots.push(parseInlineLayerContents(inlineContents));
    }
  }

  for (const path of resolveInspectableSystemManagedConfigPaths(
    dependencies.runtime.env,
    dependencies.runtime.platform,
  )) {
    const snapshot = await maybeReadLayerFromFile(
      {
        kind: "file",
        layer: "system_managed_config",
        path,
      },
      dependencies,
    );

    if (snapshot !== undefined) {
      snapshots.push(snapshot);
    }
  }

  return snapshots;
}

function resolveProjectTreeSearchRoots(
  projectRoot: string,
  cwd: string,
  platform: NodeJS.Platform,
): readonly string[] {
  const pathApi = getInstallPathApi(platform);

  if (!isPathInside(projectRoot, cwd, platform)) {
    return [projectRoot];
  }

  const roots: string[] = [];
  let currentDirectory = cwd;

  while (true) {
    roots.push(currentDirectory);

    if (currentDirectory === projectRoot) {
      break;
    }

    const parentDirectory = pathApi.dirname(currentDirectory);

    if (parentDirectory === currentDirectory) {
      break;
    }

    currentDirectory = parentDirectory;
  }

  return roots.reverse();
}

async function maybeReadLayerFromFile(
  source: EffectiveConfigVerificationInputLayerSource,
  dependencies: InstallDependencies,
): Promise<EffectiveConfigVerificationLayerSnapshot | undefined> {
  if (source.kind !== "file") {
    return undefined;
  }

  if (!(await dependencies.fs.pathExists(source.path))) {
    return undefined;
  }

  let contents: string;

  try {
    contents = await dependencies.fs.readFile(source.path, "utf8");
  } catch (cause) {
    throw createInstallError("effective_config_layer_read_failed", {
      cause,
      layer: source.layer,
      path: source.path,
    });
  }

  const parsed = tryParseJsoncObject(contents);

  if (!parsed.ok) {
    throw createInstallError("effective_config_layer_parse_failed", {
      kind: "file",
      layer: source.layer,
      path: source.path,
      reason: parsed.error.reason,
    });
  }

  return {
    config: parsed.value,
    source,
  };
}

function parseInlineLayerContents(
  contents: string,
): EffectiveConfigVerificationLayerSnapshot {
  const parsed = tryParseJsoncObject(contents);

  if (!parsed.ok) {
    throw createInstallError("effective_config_layer_parse_failed", {
      kind: "inline",
      layer: "KILO_CONFIG_CONTENT",
      reason: parsed.error.reason,
    });
  }

  return {
    config: parsed.value,
    source: {
      kind: "inline",
      layer: "KILO_CONFIG_CONTENT",
    },
  };
}

function mergeConfigObjects(
  base: Record<string, unknown>,
  override: Record<string, unknown>,
): Record<string, unknown> {
  const mergedValue: Record<string, unknown> = { ...base };

  for (const [key, overrideValue] of Object.entries(override)) {
    const baseValue = mergedValue[key];

    if (isObjectRecord(baseValue) && isObjectRecord(overrideValue)) {
      mergedValue[key] = mergeConfigObjects(baseValue, overrideValue);
      continue;
    }

    mergedValue[key] = cloneConfigValue(overrideValue);
  }

  return mergedValue;
}

function cloneConfigValue(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map((entry) => cloneConfigValue(entry));
  }

  if (!isObjectRecord(value)) {
    return value;
  }

  return Object.fromEntries(
    Object.entries(value).map(([key, nestedValue]) => [
      key,
      cloneConfigValue(nestedValue),
    ]),
  );
}

function isObjectRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function getLayerSnapshotPath(
  snapshot: EffectiveConfigVerificationLayerSnapshot,
): string | undefined {
  return snapshot.source.kind === "file" ? snapshot.source.path : undefined;
}

function getInspectableLayerPrecedence(
  layer: EffectiveConfigVerificationBlocker["layer"],
): number {
  return INSPECTABLE_LAYER_PRECEDENCE[layer];
}

function isManagedActivationOrProviderTargetPath(
  managedPaths: ManagedPaths,
  path: string | undefined,
  platform: NodeJS.Platform,
): boolean {
  return (
    isManagedUserConfigPath(managedPaths, path, platform) ||
    isManagedProjectConfigPath(managedPaths, path, platform)
  );
}

function isManagedUserConfigPath(
  managedPaths: ManagedPaths,
  path: string | undefined,
  platform: NodeJS.Platform,
): boolean {
  if (path === undefined) {
    return false;
  }

  const pathApi = getInstallPathApi(platform);
  const normalizedPath = normalizeInstallPath(path, platform);
  const expectedDirectory = pathApi.dirname(managedPaths.userConfigDefaultPath);
  const fileName = pathApi.basename(normalizedPath);

  return (
    normalizeInstallPath(pathApi.dirname(normalizedPath), platform) ===
      normalizeInstallPath(expectedDirectory, platform) &&
    (fileName === "kilo.json" || fileName === "kilo.jsonc")
  );
}

function isManagedProjectConfigPath(
  managedPaths: ManagedPaths,
  path: string | undefined,
  platform: NodeJS.Platform,
): boolean {
  if (path === undefined) {
    return false;
  }

  const pathApi = getInstallPathApi(platform);
  const normalizedPath = normalizeInstallPath(path, platform);
  const expectedDirectory = pathApi.dirname(
    managedPaths.projectConfigDefaultPath,
  );
  const fileName = pathApi.basename(normalizedPath);

  return (
    normalizeInstallPath(pathApi.dirname(normalizedPath), platform) ===
      normalizeInstallPath(expectedDirectory, platform) &&
    (fileName === "kilo.json" || fileName === "kilo.jsonc")
  );
}
