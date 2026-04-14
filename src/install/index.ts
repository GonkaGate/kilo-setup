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
import { resolveInstallModel, resolveInstallScope } from "./selection.js";
import { resolveSecretInput, writeManagedSecret } from "./secrets.js";
import { writeScopeManagedConfigs } from "./scope.js";
import {
  createManagedInstallStateRecord,
  readManagedInstallState,
  writeManagedInstallState,
} from "./state.js";
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

export async function runInstallFlow(
  request: CliOptions,
  dependencies: InstallDependencies,
): Promise<InstallFlowResult> {
  let progressState: InstallProgressState = {};
  const managedWrites = createManagedWriteTransaction();
  let installFlow: PreparedInstallSession;

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

  try {
    await applyManagedWrites(request, installFlow, managedWrites, dependencies);
    await verifyPreparedInstall(installFlow, dependencies);
    await persistInstallState(installFlow, managedWrites, dependencies);
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
    progressState,
    dependencies,
  );

  return currentSessionResult ?? createSuccessfulInstallResult(installFlow);
}

async function applyManagedWrites(
  request: CliOptions,
  installFlow: PreparedInstallSession,
  managedWrites: ReturnType<typeof createManagedWriteTransaction>,
  dependencies: InstallDependencies,
): Promise<void> {
  const previousInstallState = await readManagedInstallState(
    dependencies,
    installFlow.context.workspace.managedPaths,
  );
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
  await verifyEffectiveKiloConfig(
    {
      kiloCommand: installFlow.context.kilo.command,
      managedPaths: installFlow.context.workspace.managedPaths,
      model: installFlow.model.key,
      oracleSandboxRoot: installFlow.context.workspace.projectRoot,
      projectRoot: installFlow.context.workspace.projectRoot,
      scope: installFlow.summary.scope,
    },
    dependencies,
  );
}

async function verifyCurrentSessionInstall(
  installFlow: PreparedInstallSession,
  progressState: InstallProgressState,
  dependencies: InstallDependencies,
): Promise<InstallFlowResult | undefined> {
  if (dependencies.runtime.env.KILO_CONFIG_CONTENT === undefined) {
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
          "GonkaGate was installed durably, but the current shell is still overridden by KILO_CONFIG_CONTENT.",
        modelDisplayName: progressState.modelDisplayName,
        modelKey: progressState.modelKey,
        modelRef: progressState.modelRef,
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

function toFailedErrorCode(
  error: unknown,
): Extract<InstallFlowResult, { status: "failed" }>["errorCode"] {
  if (!isInstallError(error) || error.code === "effective_config_blocked") {
    return "unexpected_error";
  }

  return error.code;
}
