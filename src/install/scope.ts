import { type CuratedModelKey } from "../constants/models.js";
import {
  MANAGED_CONFIG_PLANS,
  type ManagedConfigTarget,
  type ManagedConfigTargetStep,
  type ManagedConfigWriteContext,
  type ManagedConfigWriteResult,
  type ManagedConfigWriteResultsByTarget,
  type ScopeWriteRequest,
  type ScopeWriteResult,
} from "./contracts/managed-config.js";
import type { InstallDependencies } from "./deps.js";
import { createInstallError } from "./errors.js";
import {
  applyManagedConfigMutations,
  readManagedConfigDocument,
  writeManagedConfigDocument,
} from "./config.js";
import { createManagedConfigMutations } from "./managed-config-mutations.js";
import {
  buildManagedProviderConfig,
  formatKiloModelRef,
} from "./managed-provider-config.js";
import {
  resolveProjectConfigTargetPath,
  resolveUserConfigTargetPath,
} from "./paths.js";

export async function writeScopeManagedConfigs(
  request: ScopeWriteRequest,
  dependencies: InstallDependencies,
): Promise<ScopeWriteResult> {
  const plan = MANAGED_CONFIG_PLANS[request.scope];
  const results = await writePlanTargets(
    plan.steps,
    createManagedConfigWriteContext(request),
    dependencies,
  );

  return {
    projectConfig: results.project_config,
    userConfig: requireTargetWriteResult(results, "user_config", request.scope),
  };
}

function createManagedConfigWriteContext(
  request: ScopeWriteRequest,
): ManagedConfigWriteContext {
  return {
    activationModelRef: formatKiloModelRef(request.model),
    managedPaths: request.managedPaths,
    ownedActivationModelRefs: createOwnedActivationModelRefs(request),
    projectRoot: request.projectRoot,
    providerConfig: buildManagedProviderConfig(request.model),
  };
}

function createOwnedActivationModelRefs(
  request: Pick<ScopeWriteRequest, "model" | "previousManagedModelKey">,
): readonly string[] {
  const ownedActivationModelRefs = new Set<string>([
    formatKiloModelRef(request.model),
  ]);

  if (request.previousManagedModelKey !== undefined) {
    ownedActivationModelRefs.add(
      formatKiloModelRef(request.previousManagedModelKey),
    );
  }

  return Object.freeze([...ownedActivationModelRefs]);
}

async function writePlanTargets(
  steps: readonly ManagedConfigTargetStep[],
  writeContext: ManagedConfigWriteContext,
  dependencies: InstallDependencies,
): Promise<ManagedConfigWriteResultsByTarget> {
  const results: ManagedConfigWriteResultsByTarget = {};

  for (const targetPlan of steps) {
    if (targetPlan.target === "user_config") {
      results.user_config = (await writeManagedConfigTarget(
        {
          targetPlan,
          writeContext,
        },
        dependencies,
      )) as ManagedConfigWriteResult<"user_config">;
      continue;
    }

    results.project_config = (await writeManagedConfigTarget(
      {
        targetPlan,
        writeContext,
      },
      dependencies,
    )) as ManagedConfigWriteResult<"project_config">;
  }

  return results;
}

async function writeManagedConfigTarget(
  request: {
    targetPlan: ManagedConfigTargetStep;
    writeContext: ManagedConfigWriteContext;
  },
  dependencies: InstallDependencies,
): Promise<ManagedConfigWriteResult<typeof request.targetPlan.target>> {
  const resolvedTarget =
    request.targetPlan.target === "user_config"
      ? await resolveUserConfigTargetPath(
          dependencies,
          request.writeContext.managedPaths,
        )
      : await resolveProjectConfigTargetPath(
          dependencies,
          request.writeContext.managedPaths,
        );
  const document = await readManagedConfigDocument(
    request.targetPlan.target,
    resolvedTarget.path,
    dependencies,
  );
  const mutations = createManagedConfigMutations({
    currentConfig: document.initialValue,
    mutationInputs: {
      activationModelRef: request.writeContext.activationModelRef,
      ownedActivationModelRefs: request.writeContext.ownedActivationModelRefs,
      providerConfig: request.writeContext.providerConfig,
    },
    targetPlan: request.targetPlan,
  });

  if (mutations.length === 0) {
    return {
      changed: false,
      created: false,
      path: document.path,
      target: request.targetPlan.target,
    } as ManagedConfigWriteResult<typeof request.targetPlan.target>;
  }

  const nextContents = applyManagedConfigMutations(document, mutations);
  const writeResult = await writeManagedConfigDocument({
    backupDirectoryPath:
      request.targetPlan.target === "user_config"
        ? request.writeContext.managedPaths.userConfigBackupDirectory
        : request.writeContext.managedPaths.projectConfigBackupDirectory,
    dependencies,
    document,
    nextContents,
  });

  return {
    ...writeResult,
    target: request.targetPlan.target,
  } as ManagedConfigWriteResult<typeof request.targetPlan.target>;
}

function requireTargetWriteResult<TTarget extends ManagedConfigTarget>(
  results: ManagedConfigWriteResultsByTarget,
  target: TTarget,
  scope: ScopeWriteRequest["scope"],
): ManagedConfigWriteResult<TTarget> {
  const result = results[target];

  if (result === undefined) {
    throw createInstallError("managed_config_plan_invalid", {
      missingTarget: target,
      scope,
    });
  }

  return result as ManagedConfigWriteResult<TTarget>;
}

export function createOwnedActivationModelRefsForTesting(
  model: CuratedModelKey,
  previousManagedModelKey?: CuratedModelKey,
): readonly string[] {
  return createOwnedActivationModelRefs({
    model,
    previousManagedModelKey,
  });
}
