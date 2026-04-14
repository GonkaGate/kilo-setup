import {
  detectInstalledKilo,
  type KiloDetectionResult,
  type SupportedKiloDetection,
} from "./kilo.js";
import type { InstallDependencies } from "./deps.js";
import {
  resolveManagedPaths,
  resolveProjectRoot,
  type ManagedPaths,
  type ProjectRootResolution,
} from "./paths.js";

export interface InstallWorkspaceContext extends ProjectRootResolution {
  managedPaths: ManagedPaths;
}

export interface ResolvedInstallContext {
  kilo: SupportedKiloDetection["kilo"];
  workspace: InstallWorkspaceContext;
}

export async function resolveInstallContext(
  dependencies: InstallDependencies,
  options?: {
    cwd?: string;
  },
): Promise<ResolvedInstallContext | KiloDetectionResult> {
  const [workspace, kiloDetection] = await Promise.all([
    resolveProjectRoot(dependencies, options?.cwd),
    detectInstalledKilo(dependencies),
  ]);

  if (!kiloDetection.ok) {
    return kiloDetection;
  }

  return {
    kilo: kiloDetection.kilo,
    workspace: {
      ...workspace,
      managedPaths: resolveManagedPaths(
        dependencies.runtime.homeDir,
        workspace.projectRoot,
        dependencies.runtime.platform,
      ),
    },
  };
}
