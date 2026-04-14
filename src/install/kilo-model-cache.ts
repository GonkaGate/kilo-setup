import { GONKAGATE_PROVIDER_ID } from "../constants/gateway.js";
import type { InstallDependencies } from "./deps.js";
import { getInstallPathApi, normalizeInstallPath } from "./platform-path.js";

export interface KiloModelCacheInspection {
  currentModelId?: string;
  path?: string;
  status:
    | "gonkagate_selected"
    | "other_selected"
    | "selection_unset"
    | "unsupported_platform"
    | "unreadable";
}

export interface KiloModelCacheClearResult {
  path?: string;
  status:
    | "cleared"
    | "already_clear"
    | "missing"
    | "unsupported_platform"
    | "unreadable";
}

export async function inspectKiloModelCache(
  dependencies: Pick<InstallDependencies, "fs" | "runtime">,
): Promise<KiloModelCacheInspection> {
  const path = resolveKiloModelCachePath(
    dependencies.runtime.homeDir,
    dependencies.runtime.platform,
  );

  if (path === undefined) {
    return {
      status: "unsupported_platform",
    };
  }

  if (!(await dependencies.fs.pathExists(path))) {
    return {
      path,
      status: "selection_unset",
    };
  }

  let parsed: Record<string, unknown>;

  try {
    parsed = JSON.parse(await dependencies.fs.readFile(path, "utf8")) as Record<
      string,
      unknown
    >;
  } catch {
    return {
      path,
      status: "unreadable",
    };
  }

  const currentSelection = getCurrentModelSelection(parsed);

  if (currentSelection === undefined) {
    return {
      path,
      status: "selection_unset",
    };
  }

  return {
    currentModelId: currentSelection.modelID,
    path,
    status:
      currentSelection.providerID === GONKAGATE_PROVIDER_ID
        ? "gonkagate_selected"
        : "other_selected",
  };
}

export async function clearKiloModelCacheSelection(
  dependencies: Pick<InstallDependencies, "fs" | "runtime">,
): Promise<KiloModelCacheClearResult> {
  const path = resolveKiloModelCachePath(
    dependencies.runtime.homeDir,
    dependencies.runtime.platform,
  );

  if (path === undefined) {
    return {
      status: "unsupported_platform",
    };
  }

  if (!(await dependencies.fs.pathExists(path))) {
    return {
      path,
      status: "missing",
    };
  }

  let parsed: Record<string, unknown>;

  try {
    parsed = JSON.parse(await dependencies.fs.readFile(path, "utf8")) as Record<
      string,
      unknown
    >;
  } catch {
    return {
      path,
      status: "unreadable",
    };
  }

  if (getCurrentModelSelection(parsed) === undefined) {
    return {
      path,
      status: "already_clear",
    };
  }

  try {
    await dependencies.fs.writeFileAtomic(
      path,
      serializeKiloModelCacheDocument({
        ...parsed,
        model: {},
      }),
      {
        encoding: "utf8",
      },
    );
  } catch {
    return {
      path,
      status: "unreadable",
    };
  }

  return {
    path,
    status: "cleared",
  };
}

function resolveKiloModelCachePath(
  homeDirectory: string,
  platform: NodeJS.Platform,
): string | undefined {
  if (platform === "win32") {
    return undefined;
  }

  const pathApi = getInstallPathApi(platform);
  const normalizedHomeDirectory = normalizeInstallPath(homeDirectory, platform);

  return pathApi.join(
    normalizedHomeDirectory,
    ".local",
    "state",
    "kilo",
    "model.json",
  );
}

function getCurrentModelSelection(
  value: Record<string, unknown>,
): { modelID?: string; providerID?: string } | undefined {
  const model = value.model;

  if (!isObjectRecord(model)) {
    return undefined;
  }

  const code = model.code;

  if (!isObjectRecord(code)) {
    return undefined;
  }

  const providerID =
    typeof code.providerID === "string" ? code.providerID : undefined;
  const modelID = typeof code.modelID === "string" ? code.modelID : undefined;

  if (providerID === undefined && modelID === undefined) {
    return undefined;
  }

  return {
    modelID,
    providerID,
  };
}

function serializeKiloModelCacheDocument(
  value: Record<string, unknown>,
): string {
  return `${JSON.stringify(value, null, 2)}\n`;
}

function isObjectRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}
