import type {
  EffectiveConfigVerificationBlocker,
  EffectiveConfigVerificationMismatch,
  EffectiveConfigVerificationTarget,
} from "./contracts/effective-config.js";
import type {
  ManagedConfigScope,
  ManagedConfigTarget,
} from "./contracts/managed-config.js";
import type { AllowedSecretInput } from "./contracts/secret-intake.js";

export interface InstallErrorDetailsByCode {
  effective_config_blocked: {
    blockers: readonly EffectiveConfigVerificationBlocker[];
    target: EffectiveConfigVerificationTarget;
  };
  effective_config_layer_parse_failed:
    | {
        kind: "file";
        layer: EffectiveConfigVerificationBlocker["layer"];
        path: string;
        reason: string;
      }
    | {
        kind: "inline";
        layer: "KILO_CONFIG_CONTENT";
        reason: string;
      };
  effective_config_layer_read_failed: {
    cause: unknown;
    layer: EffectiveConfigVerificationBlocker["layer"];
    path: string;
  };
  effective_config_mismatch: {
    mismatches: readonly EffectiveConfigVerificationMismatch[];
    target: EffectiveConfigVerificationTarget;
  };
  effective_config_oracle_command_failed: {
    args: readonly string[];
    cause?: unknown;
    command: string;
    exitCode?: number;
    signal?: NodeJS.Signals | null;
  };
  effective_config_oracle_parse_failed: {
    reason: string;
  };
  managed_config_backup_failed: {
    cause: unknown;
    path: string;
    target: ManagedConfigTarget;
  };
  managed_config_merge_failed: {
    keyPath: string;
    path: string;
    reason: string;
    target: ManagedConfigTarget;
  };
  managed_config_parse_failed: {
    path: string;
    reason: string;
    target: ManagedConfigTarget;
  };
  managed_config_plan_invalid: {
    missingTarget: ManagedConfigTarget;
    scope: ManagedConfigScope;
  };
  managed_config_write_failed: {
    cause: unknown;
    path: string;
    target: ManagedConfigTarget;
  };
  managed_secret_write_failed: {
    cause: unknown;
    source: AllowedSecretInput;
    target: "managed_secret";
  };
  managed_rollback_failed: {
    cause: unknown;
  };
  managed_state_backup_failed: {
    cause: unknown;
    target: "managed_install_state";
  };
  managed_state_write_failed: {
    cause: unknown;
    target: "managed_install_state";
  };
  model_selection_required: {
    validatedModelCount: number;
  };
  secret_prompt_unavailable: {
    stdinIsTTY: boolean;
    stdoutIsTTY: boolean;
  };
  secret_source_unavailable: {
    source: AllowedSecretInput;
  };
  secret_stdin_empty: {
    source: "api_key_stdin";
  };
  scope_selection_required: {
    insideGitRepository: boolean;
  };
  unsupported_model_key: {
    modelKey: string;
  };
  validated_models_unavailable: {};
}

export type InstallErrorCode = keyof InstallErrorDetailsByCode;
export type InstallErrorDetails<TCode extends InstallErrorCode> =
  InstallErrorDetailsByCode[TCode];

const INSTALL_ERROR_MESSAGE_FACTORIES: {
  [TCode in InstallErrorCode]: (details: InstallErrorDetails<TCode>) => string;
} = {
  effective_config_blocked: () =>
    "Local Kilo verification found higher-precedence blockers for the intended GonkaGate setup.",
  effective_config_layer_parse_failed: (details) =>
    details.kind === "inline"
      ? `Failed to parse ${details.layer} as JSON or JSONC (${details.reason}).`
      : `Failed to parse the ${details.layer} layer at ${details.path} as JSON or JSONC (${details.reason}).`,
  effective_config_layer_read_failed: (details) =>
    `Failed to read the ${details.layer} layer at ${details.path}.`,
  effective_config_mismatch: () =>
    "Resolved local Kilo config does not match the intended GonkaGate contract.",
  effective_config_oracle_command_failed: (details) =>
    details.exitCode === undefined
      ? `Failed to run the sandboxed Kilo oracle command: ${details.command} ${details.args.join(" ")}.`
      : `The sandboxed Kilo oracle command failed with exit code ${details.exitCode}: ${details.command} ${details.args.join(" ")}.`,
  effective_config_oracle_parse_failed: (details) =>
    `Failed to parse sandboxed Kilo oracle output as JSON or JSONC (${details.reason}).`,
  managed_config_backup_failed: (details) =>
    `Failed to back up the existing ${formatManagedConfigTarget(details.target)} at ${details.path} before replacement.`,
  managed_config_merge_failed: (details) =>
    `Could not safely merge GonkaGate-managed keys into the ${formatManagedConfigTarget(details.target)} at ${details.path} (${details.keyPath}: ${details.reason}).`,
  managed_config_parse_failed: (details) =>
    `Failed to parse the existing ${formatManagedConfigTarget(details.target)} at ${details.path} as JSON or JSONC (${details.reason}).`,
  managed_config_plan_invalid: (details) =>
    `Managed config plan for ${details.scope} scope is missing the required ${formatManagedConfigTarget(details.missingTarget)} step.`,
  managed_config_write_failed: (details) =>
    `Failed to write the ${formatManagedConfigTarget(details.target)} at ${details.path}.`,
  managed_rollback_failed: () =>
    "Failed to roll back installer-owned files after an install error.",
  managed_secret_write_failed: () =>
    "Failed to write the managed GonkaGate secret into user-scoped storage.",
  managed_state_backup_failed: () =>
    "Failed to back up the managed install-state file before replacement.",
  managed_state_write_failed: () =>
    "Failed to write the managed install-state file.",
  model_selection_required: (details) =>
    details.validatedModelCount === 1
      ? "A validated GonkaGate model exists, but non-interactive setup still needs --yes to accept it or interactive prompts to confirm it."
      : "Multiple validated GonkaGate models are available. Pass --model, use --yes for the recommended default, or rerun interactively.",
  secret_prompt_unavailable: () =>
    "A hidden GonkaGate API key prompt requires an interactive terminal. Use GONKAGATE_API_KEY or --api-key-stdin for non-interactive setup.",
  secret_source_unavailable: (details) =>
    `A GonkaGate API key was not provided through the allowed ${details.source} input.`,
  secret_stdin_empty: () =>
    "No GonkaGate API key was received on stdin after --api-key-stdin was requested.",
  scope_selection_required: (details) =>
    details.insideGitRepository
      ? "Non-interactive setup inside a git repository requires --scope or --yes so the installer can choose between user and project activation safely."
      : "Non-interactive setup requires --scope or --yes so the installer can confirm the activation scope safely.",
  unsupported_model_key: (details) =>
    `The model key ${details.modelKey} is not a validated curated GonkaGate Kilo option.`,
  validated_models_unavailable: () =>
    "No validated curated GonkaGate Kilo models are currently available in this package build.",
};

export class InstallError<TCode extends InstallErrorCode> extends Error {
  readonly code: TCode;
  readonly details: InstallErrorDetails<TCode>;

  constructor(code: TCode, details: InstallErrorDetails<TCode>) {
    super(INSTALL_ERROR_MESSAGE_FACTORIES[code](details));
    this.name = "InstallError";
    this.code = code;
    this.details = details;
  }
}

export function createInstallError<TCode extends InstallErrorCode>(
  code: TCode,
  details: InstallErrorDetails<TCode>,
): InstallError<TCode> {
  return new InstallError(code, details);
}

export function isInstallErrorCode<TCode extends InstallErrorCode>(
  error: unknown,
  code: TCode,
): error is InstallError<TCode> {
  return error instanceof InstallError && error.code === code;
}

export function isInstallError(
  error: unknown,
): error is InstallError<InstallErrorCode> {
  return error instanceof InstallError;
}

function formatManagedConfigTarget(target: ManagedConfigTarget): string {
  return target === "project_config" ? "project config" : "user config";
}
