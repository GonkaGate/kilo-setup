import type {
  EffectiveConfigVerificationBlocker,
  EffectiveConfigVerificationMismatch,
  EffectiveConfigVerificationTarget,
} from "./contracts/effective-config.js";
import type {
  CuratedModelKey,
  CuratedModelTransport,
} from "../constants/models.js";
import type { GONKAGATE_PROVIDER_ID } from "../constants/gateway.js";
import type { InstallErrorCode } from "./errors.js";

export type InstallScope = "project" | "user";
export type InstallFlowStatus =
  | "blocked"
  | "failed"
  | "installed"
  | "rolled_back";
export type InstallFlowErrorCode =
  | "effective_config_blocked"
  | "effective_config_mismatch"
  | "installation_failed"
  | "installation_rolled_back"
  | "kilo_not_found"
  | "managed_rollback_failed"
  | "model_selection_required"
  | "scope_selection_required"
  | "unsupported_model_key"
  | "validated_models_unavailable"
  | "kilo_version_unparseable"
  | "kilo_version_unsupported";

export type KiloCommandName = "kilo" | "kilocode";
export type KiloCompatibilityProfileId = "kilo_cli_7_2_0";

export interface InstallFlowContext {
  configTargets: {
    global: string;
    project: string;
  };
  envVars: {
    config: string;
    configContent: string;
  };
  kiloCommands: readonly [KiloCommandName, KiloCommandName];
  packageName: string;
  provider: {
    baseUrl: string;
    id: string;
    transport: string;
  };
}

export interface SupportedKiloSummary {
  command: KiloCommandName;
  installedVersion: string;
  profileId: KiloCompatibilityProfileId;
}

export interface BlockedKiloSummary {
  command: KiloCommandName;
  installedVersion?: string;
}

interface InstallFlowResultBase {
  context: InstallFlowContext;
  message: string;
  ok: boolean;
  status: InstallFlowStatus;
}

export interface InstallFlowSelectionSummary {
  kilo: SupportedKiloSummary;
  modelDisplayName: string;
  modelKey: CuratedModelKey;
  modelRef: string;
  scope: InstallScope;
}

export interface InstallFlowProgress {
  kilo?: SupportedKiloSummary;
  modelDisplayName?: string;
  modelKey?: CuratedModelKey;
  modelRef?: string;
  scope?: InstallScope;
}

export interface BlockedInstallResult extends InstallFlowResultBase {
  blockers?: readonly EffectiveConfigVerificationBlocker[];
  errorCode:
    | "effective_config_blocked"
    | "kilo_not_found"
    | "kilo_version_unparseable"
    | "kilo_version_unsupported"
    | "scope_selection_required";
  kilo?: BlockedKiloSummary | SupportedKiloSummary;
  modelDisplayName?: string;
  modelKey?: CuratedModelKey;
  modelRef?: string;
  ok: false;
  mismatches?: readonly EffectiveConfigVerificationMismatch[];
  scope?: InstallScope;
  status: "blocked";
  verificationTarget?: EffectiveConfigVerificationTarget;
}

export interface FailedInstallResult
  extends InstallFlowResultBase, InstallFlowProgress {
  errorCode:
    | Exclude<InstallErrorCode, "effective_config_blocked">
    | "unexpected_error";
  ok: false;
  status: "failed";
  mismatches?: readonly EffectiveConfigVerificationMismatch[];
  verificationTarget?: EffectiveConfigVerificationTarget;
}

export interface RolledBackInstallResult
  extends InstallFlowResultBase, InstallFlowProgress {
  errorCode: "installation_rolled_back";
  ok: false;
  status: "rolled_back";
}

export interface InstalledInstallResult
  extends InstallFlowResultBase, InstallFlowSelectionSummary {
  errorCode?: undefined;
  ok: true;
  providerId: typeof GONKAGATE_PROVIDER_ID;
  scope: InstallScope;
  status: "installed";
  transport: CuratedModelTransport;
}

export type InstallFlowResult =
  | BlockedInstallResult
  | FailedInstallResult
  | InstalledInstallResult
  | RolledBackInstallResult;
