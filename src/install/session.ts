import { GONKAGATE_PROVIDER_ID } from "../constants/gateway.js";
import {
  CURRENT_TRANSPORT_TARGET,
  GONKAGATE_BASE_URL,
  GONKAGATE_PROVIDER_ID as GONKAGATE_PROVIDER_ID_VALUE,
} from "../constants/gateway.js";
import { CONTRACT_METADATA } from "../constants/contract.js";
import {
  KILO_CONFIG_CONTENT_ENV_VAR,
  KILO_CONFIG_ENV_VAR,
  KILO_FALLBACK_COMMAND,
  KILO_PREFERRED_GLOBAL_CONFIG,
  KILO_PREFERRED_PROJECT_CONFIG,
  KILO_PRIMARY_COMMAND,
} from "./kilo.js";
import type {
  CuratedModelKey,
  ValidatedCuratedModel,
} from "../constants/models.js";
import type { ResolvedInstallContext } from "./context.js";
import { formatKiloModelRef } from "./managed-provider-config.js";
import type {
  InstalledInstallResult,
  InstallFlowProgress,
  InstallFlowContext,
  InstallFlowSelectionSummary,
  InstallScope,
  SupportedKiloSummary,
} from "./contracts.js";

export type InstallProgressState = InstallFlowProgress;

export interface PreparedInstallSession {
  context: ResolvedInstallContext;
  model: ValidatedCuratedModel;
  summary: InstallFlowSelectionSummary;
}

export function createInstallProgressState(
  kilo: SupportedKiloSummary,
  model?: ValidatedCuratedModel,
  scope?: InstallScope,
): InstallProgressState {
  return {
    kilo,
    modelDisplayName: model?.displayName,
    modelKey: model?.key,
    modelRef:
      model === undefined
        ? undefined
        : (formatKiloModelRef(model) as `gonkagate/${CuratedModelKey}`),
    scope,
  };
}

export function prepareInstallSession(
  context: ResolvedInstallContext,
  model: ValidatedCuratedModel,
  scope: InstallScope,
): PreparedInstallSession {
  return {
    context,
    model,
    summary: {
      kilo: context.kilo,
      modelDisplayName: model.displayName,
      modelKey: model.key,
      modelRef: formatKiloModelRef(model),
      scope,
    },
  };
}

export function createSuccessfulInstallResult(
  session: PreparedInstallSession,
): InstalledInstallResult {
  return {
    context: createInstallFlowContext(),
    kilo: session.context.kilo,
    message: "GonkaGate is configured for Kilo.",
    modelDisplayName: session.summary.modelDisplayName,
    modelKey: session.summary.modelKey,
    modelRef: session.summary.modelRef,
    ok: true,
    providerId: GONKAGATE_PROVIDER_ID,
    scope: session.summary.scope,
    status: "installed",
    transport: session.model.transport,
  };
}

export function createInstallFlowContext(): InstallFlowContext {
  return {
    configTargets: {
      global: KILO_PREFERRED_GLOBAL_CONFIG,
      project: KILO_PREFERRED_PROJECT_CONFIG,
    },
    envVars: {
      config: KILO_CONFIG_ENV_VAR,
      configContent: KILO_CONFIG_CONTENT_ENV_VAR,
    },
    kiloCommands: [KILO_PRIMARY_COMMAND, KILO_FALLBACK_COMMAND],
    packageName: CONTRACT_METADATA.packageName,
    provider: {
      baseUrl: GONKAGATE_BASE_URL,
      id: GONKAGATE_PROVIDER_ID_VALUE,
      transport: CURRENT_TRANSPORT_TARGET,
    },
  };
}
