import {
  createInstallFlowContext,
  createInstallProgressState,
  createSuccessfulInstallResult,
  prepareInstallSession,
  type InstallProgressState,
  type PreparedInstallSession,
} from "./session.js";
import { createManagedWriteTransaction } from "./managed-write-transaction.js";
import { rollbackManagedWrites } from "./rollback.js";
import { resolveInstallContext } from "./context.js";
import {
  canUseInteractiveInstallPrompts,
  resolveInstallModel,
  resolveInstallScope,
} from "./selection.js";
import { resolveSecretInput, writeManagedSecret } from "./secrets.js";
import { writeScopeManagedConfigs } from "./scope.js";
import {
  createManagedInstallStateRecord,
  readManagedInstallState,
  writeManagedInstallState,
} from "./state.js";
import type { ManagedInstallStateRecord } from "./contracts/install-state.js";
import {
  verifyCurrentSessionKiloConfig,
  verifyEffectiveKiloConfig,
} from "./verify-effective.js";
import type { ManagedArtifactRollbackAction } from "./contracts/managed-artifact.js";
import type { CliOptions } from "../cli/contracts.js";
import type { InstallDependencies } from "./deps.js";
import { isInstallError, isInstallErrorCode } from "./errors.js";
import type { InstallFlowResult } from "./contracts.js";
import { redactSecretBearingText } from "./redact.js";
import {
  hasCurrentSessionRuntimeOverrides,
  stripKiloTerminalRuntimeOverrides,
} from "./runtime-overrides.js";
import {
  clearKiloModelCacheSelection,
  inspectKiloModelCache,
} from "./kilo-model-cache.js";

export async function runInstallFlow(
  request: CliOptions,
  dependencies: InstallDependencies,
): Promise<InstallFlowResult> {
  let progressState: InstallProgressState = {};
  const managedWrites = createManagedWriteTransaction();
  let installFlow: PreparedInstallSession;
  let previousInstallState: ManagedInstallStateRecord | undefined;

  try {
    const resolvedContext = await resolveInstallContext(dependencies, {
      cwd: request.cwd,
    });

    if (!("workspace" in resolvedContext)) {
      if (resolvedContext.ok) {
        throw new Error(
          "Resolved install context returned a supported Kilo detection without workspace details.",
        );
      }

      return {
        context: createInstallFlowContext(),
        errorCode: resolvedContext.errorCode,
        kilo: resolvedContext.kilo,
        message: resolvedContext.message,
        ok: false,
        status: "blocked",
      };
    }

    previousInstallState = await readManagedInstallState(
      dependencies,
      resolvedContext.workspace.managedPaths,
    );
    const model = await resolveInstallModel(
      {
        modelKey: request.modelKey,
        yes: request.yes,
      },
      dependencies,
    );
    progressState = createInstallProgressState(resolvedContext.kilo, model);

    const scope = await resolveInstallScope(
      {
        insideGitRepository: resolvedContext.workspace.insideGitRepository,
        previousManagedScope: previousInstallState?.selectedScope,
        scope: request.scope,
        yes: request.yes,
      },
      dependencies,
    );
    installFlow = prepareInstallSession(resolvedContext, model, scope);
    progressState = installFlow.summary;
  } catch (error) {
    return buildInstallErrorResult(error, progressState);
  }

  let notices: readonly string[] = [];

  try {
    await applyManagedWrites(
      request,
      installFlow,
      previousInstallState,
      managedWrites,
      dependencies,
    );
    await verifyPreparedInstall(installFlow, dependencies);
    await persistInstallState(installFlow, managedWrites, dependencies);
    notices = await collectPostInstallNotices(
      request,
      installFlow,
      dependencies,
    );
  } catch (error) {
    return await buildInstallFailureResult(
      error,
      progressState,
      managedWrites.rollbackActions,
      dependencies,
    );
  }

  const currentSessionResult = await verifyCurrentSessionInstall(
    installFlow,
    notices,
    progressState,
    dependencies,
  );

  return (
    currentSessionResult ?? createSuccessfulInstallResult(installFlow, notices)
  );
}

async function applyManagedWrites(
  request: CliOptions,
  installFlow: PreparedInstallSession,
  previousInstallState: ManagedInstallStateRecord | undefined,
  managedWrites: ReturnType<typeof createManagedWriteTransaction>,
  dependencies: InstallDependencies,
): Promise<void> {
  const resolvedSecret = await resolveSecretInput(
    {
      apiKeyStdin: request.apiKeyStdin,
    },
    dependencies,
  );

  await managedWrites.run(
    writeManagedSecret(
      {
        managedPaths: installFlow.context.workspace.managedPaths,
        resolvedSecret,
      },
      dependencies,
    ),
  );
  await managedWrites.runAll(
    writeScopeManagedConfigs(
      {
        managedPaths: installFlow.context.workspace.managedPaths,
        model: installFlow.model.key,
        previousManagedModelKey: previousInstallState?.selectedModelKey,
        projectRoot: installFlow.context.workspace.projectRoot,
        scope: installFlow.summary.scope,
      },
      dependencies,
    ).then(({ projectConfig, userConfig }) => [userConfig, projectConfig]),
  );
}

async function verifyPreparedInstall(
  installFlow: PreparedInstallSession,
  dependencies: InstallDependencies,
): Promise<void> {
  const durableVerificationDependencies =
    createDurableVerificationDependencies(dependencies);

  await verifyEffectiveKiloConfig(
    {
      kiloCommand: installFlow.context.kilo.command,
      managedPaths: installFlow.context.workspace.managedPaths,
      model: installFlow.model.key,
      oracleSandboxRoot: installFlow.context.workspace.projectRoot,
      projectRoot: installFlow.context.workspace.projectRoot,
      scope: installFlow.summary.scope,
    },
    durableVerificationDependencies,
  );
}

async function verifyCurrentSessionInstall(
  installFlow: PreparedInstallSession,
  notices: readonly string[],
  progressState: InstallProgressState,
  dependencies: InstallDependencies,
): Promise<InstallFlowResult | undefined> {
  if (!hasCurrentSessionRuntimeOverrides(dependencies.runtime.env)) {
    return undefined;
  }

  try {
    await verifyCurrentSessionKiloConfig(
      {
        managedPaths: installFlow.context.workspace.managedPaths,
        model: installFlow.model.key,
        projectRoot: installFlow.context.workspace.projectRoot,
        scope: installFlow.summary.scope,
      },
      dependencies,
    );
  } catch (error) {
    if (isInstallErrorCode(error, "effective_config_blocked")) {
      return {
        blockers: error.details.blockers,
        context: createInstallFlowContext(),
        errorCode: error.code,
        kilo: installFlow.context.kilo,
        message:
          "GonkaGate was installed durably, but the current shell is still overridden by active Kilo runtime config.",
        modelDisplayName: progressState.modelDisplayName,
        modelKey: progressState.modelKey,
        modelRef: progressState.modelRef,
        notices,
        ok: false,
        scope: progressState.scope,
        status: "blocked",
        verificationTarget: error.details.target,
      };
    }

    return buildInstallErrorResult(error, progressState);
  }

  return undefined;
}

async function collectPostInstallNotices(
  request: CliOptions,
  installFlow: PreparedInstallSession,
  dependencies: InstallDependencies,
): Promise<readonly string[]> {
  if (installFlow.summary.scope !== "project") {
    return [];
  }

  const interactive =
    !request.yes && canUseInteractiveInstallPrompts(dependencies);
  const inspection = await inspectKiloModelCache(dependencies);

  if (request.clearKiloModelCache) {
    const clearResult = await clearKiloModelCacheSelection(dependencies);

    return [formatProjectScopeCacheClearNotice(clearResult, inspection.path)];
  }

  if (interactive && inspection.status === "gonkagate_selected") {
    const selection = await dependencies.prompts.selectOption({
      choices: [
        {
          description:
            "Remove only Kilo's current global UI-selected model for now. Kilo can set it again later.",
          label: "Clear cached model (Recommended)",
          value: "clear",
        },
        {
          description:
            "Keep GonkaGate as the current last-selected model across repositories.",
          label: "Keep cached model",
          value: "keep",
        },
      ],
      defaultValue: "clear",
      message:
        "Kilo currently remembers GonkaGate as the last UI-selected model for this machine. Clear that cached model now so other repositories can fall back to their own config?",
    });

    if (selection === "clear") {
      const clearResult = await clearKiloModelCacheSelection(dependencies);

      return [formatProjectScopeCacheClearNotice(clearResult, inspection.path)];
    }

    return [createPersistingProjectScopeCacheNotice(inspection.path)];
  }

  return [createProjectScopeCacheNotice(inspection.path)];
}

async function persistInstallState(
  installFlow: PreparedInstallSession,
  managedWrites: ReturnType<typeof createManagedWriteTransaction>,
  dependencies: InstallDependencies,
): Promise<void> {
  await managedWrites.run(
    writeManagedInstallState(
      createManagedInstallStateRecord({
        configTargets: {
          project:
            installFlow.summary.scope === "project"
              ? installFlow.context.workspace.managedPaths
                  .projectConfigDefaultPath
              : undefined,
          user: installFlow.context.workspace.managedPaths
            .userConfigDefaultPath,
        },
        currentTransport: installFlow.model.transport,
        kiloCommand: installFlow.context.kilo.command,
        kiloVersion: installFlow.context.kilo.installedVersion,
        lastDurableSetupAt: dependencies.clock.now().toISOString(),
        selectedModelKey: installFlow.model.key,
        selectedScope: installFlow.summary.scope,
      }),
      dependencies,
      installFlow.context.workspace.managedPaths,
    ),
  );
}

async function buildInstallFailureResult(
  error: unknown,
  progressState: InstallProgressState,
  rollbackActions: readonly ManagedArtifactRollbackAction[],
  dependencies: InstallDependencies,
): Promise<InstallFlowResult> {
  if (rollbackActions.length === 0) {
    return buildInstallErrorResult(error, progressState);
  }

  try {
    await rollbackManagedWrites(rollbackActions, dependencies);
  } catch (rollbackError) {
    return buildInstallErrorResult(rollbackError, progressState);
  }

  return {
    ...progressState,
    context: createInstallFlowContext(),
    errorCode: "installation_rolled_back",
    message: `Installation failed and installer-owned writes were rolled back. ${formatInstallFailureMessage(
      error,
    )}`,
    ok: false,
    status: "rolled_back",
  };
}

function buildInstallErrorResult(
  error: unknown,
  progressState: InstallProgressState,
): InstallFlowResult {
  if (isInstallErrorCode(error, "effective_config_blocked")) {
    return {
      ...progressState,
      blockers: error.details.blockers,
      context: createInstallFlowContext(),
      errorCode: error.code,
      message: error.message,
      ok: false,
      status: "blocked",
      verificationTarget: error.details.target,
    };
  }

  if (isInstallErrorCode(error, "effective_config_mismatch")) {
    return {
      ...progressState,
      context: createInstallFlowContext(),
      errorCode: error.code,
      message: error.message,
      mismatches: error.details.mismatches,
      ok: false,
      status: "failed",
      verificationTarget: error.details.target,
    };
  }

  return {
    ...progressState,
    context: createInstallFlowContext(),
    errorCode: toFailedErrorCode(error),
    message: formatInstallFailureMessage(error),
    ok: false,
    status: "failed",
  };
}

function formatInstallFailureMessage(error: unknown): string {
  if (error instanceof Error) {
    return redactSecretBearingText(error.message);
  }

  return redactSecretBearingText(String(error));
}

function createDurableVerificationDependencies(
  dependencies: InstallDependencies,
): InstallDependencies {
  const durableVerificationEnv = stripKiloTerminalRuntimeOverrides(
    dependencies.runtime.env,
  );

  if (durableVerificationEnv === dependencies.runtime.env) {
    return dependencies;
  }

  return {
    ...dependencies,
    runtime: {
      ...dependencies.runtime,
      env: durableVerificationEnv,
    },
  };
}

function toFailedErrorCode(
  error: unknown,
): Extract<InstallFlowResult, { status: "failed" }>["errorCode"] {
  if (!isInstallError(error) || error.code === "effective_config_blocked") {
    return "unexpected_error";
  }

  return error.code;
}

function createProjectScopeCacheNotice(path?: string): string {
  if (path === undefined) {
    return "Kilo can remember the last UI-selected model across repositories after future interactive model changes. If another repository later opens on GonkaGate, switch models there or clear Kilo's global model cache.";
  }

  return `Kilo can remember the last UI-selected model across repositories. If another repository later opens on GonkaGate, switch models there or clear ${path}.`;
}

function createPersistingProjectScopeCacheNotice(path?: string): string {
  if (path === undefined) {
    return "Kilo still remembers GonkaGate as the last UI-selected model for this machine. Another repository may open on GonkaGate until you switch models there or clear Kilo's global model cache.";
  }

  return `Kilo still remembers GonkaGate as the last UI-selected model for this machine. Another repository may open on GonkaGate until you switch models there or clear ${path}.`;
}

function formatProjectScopeCacheClearNotice(
  result: Awaited<ReturnType<typeof clearKiloModelCacheSelection>>,
  fallbackPath?: string,
): string {
  const path = result.path ?? fallbackPath;

  if (result.status === "cleared") {
    return path === undefined
      ? "Cleared Kilo's cached last UI-selected model for now. Kilo may set it again after future interactive model changes."
      : `Cleared Kilo's cached last UI-selected model at ${path} for now. Kilo may set it again after future interactive model changes.`;
  }

  if (result.status === "already_clear" || result.status === "missing") {
    return path === undefined
      ? "Kilo's cached last UI-selected model was already clear. Kilo may still set it again after future interactive model changes."
      : `Kilo's cached last UI-selected model at ${path} was already clear. Kilo may still set it again after future interactive model changes.`;
  }

  if (result.status === "unsupported_platform") {
    return "GonkaGate was installed for this repository, but this platform's Kilo global model-cache path is not currently managed by the installer.";
  }

  return path === undefined
    ? "GonkaGate was installed, but Kilo's cached last UI-selected model could not be updated. Another repository may still open on GonkaGate until you switch models there."
    : `GonkaGate was installed, but Kilo's cached last UI-selected model at ${path} could not be updated. Another repository may still open on GonkaGate until you switch models there.`;
}
