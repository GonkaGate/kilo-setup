import { valid } from "semver";
import type {
  BlockedKiloSummary,
  InstallFlowErrorCode,
  KiloCommandName,
  SupportedKiloSummary,
} from "./contracts.js";
import type { InstallDependencies } from "./deps.js";

export const KILO_PACKAGE_NAME = "@kilocode/cli";
export const KILO_INVESTIGATED_VERSION = "7.2.0";
export const KILO_MINIMUM_VERSION_STATUS = "proof-gate-pending";
export const KILO_PRIMARY_COMMAND = "kilo";
export const KILO_FALLBACK_COMMAND = "kilocode";
export const KILO_CONFIG_ENV_VAR = "KILO_CONFIG";
export const KILO_CONFIG_DIR_ENV_VAR = "KILO_CONFIG_DIR";
export const KILO_CONFIG_CONTENT_ENV_VAR = "KILO_CONFIG_CONTENT";
export const KILO_TEST_MANAGED_CONFIG_DIR_ENV_VAR =
  "KILO_TEST_MANAGED_CONFIG_DIR";
export const KILO_PREFERRED_GLOBAL_CONFIG = "~/.config/kilo/kilo.jsonc";
export const KILO_PREFERRED_PROJECT_CONFIG = ".kilo/kilo.jsonc";
export const KILO_MANAGED_STATE_DIRECTORY = "~/.gonkagate/kilo";
export const KILO_DEBUG_CONFIG_COMMAND = "kilo debug config";
export const KILO_DEBUG_CONFIG_PURE_SUPPORTED = false;
export const KILO_COMPATIBILITY_PROFILE_7_2_0 = Object.freeze({
  id: "kilo_cli_7_2_0",
  supportedVersion: KILO_INVESTIGATED_VERSION,
} as const);

export const KILO_LEGACY_CONFIG_FILES = Object.freeze([
  "config.json",
  "kilo.json",
  "kilo.jsonc",
  "opencode.json",
  "opencode.jsonc",
] as const);
export const KILO_GLOBAL_CONFIG_FILE_ORDER = KILO_LEGACY_CONFIG_FILES;
export const KILO_PROJECT_ROOT_CONFIG_FILE_ORDER = Object.freeze([
  "kilo.jsonc",
  "kilo.json",
  "opencode.jsonc",
  "opencode.json",
] as const);
export const KILO_DIRECTORY_CONFIG_FILE_ORDER =
  KILO_PROJECT_ROOT_CONFIG_FILE_ORDER;
export const KILO_PROJECT_DIRECTORY_NAMES = Object.freeze([
  ".kilocode",
  ".kilo",
  ".opencode",
] as const);

export interface KiloCompatibilityProfile {
  id: string;
  supportedVersion: string;
}

export interface KiloDetectionBlocked {
  errorCode:
    | "kilo_not_found"
    | "kilo_version_unparseable"
    | "kilo_version_unsupported";
  kilo?: BlockedKiloSummary;
  message: string;
  ok: false;
}

export interface SupportedKiloDetection {
  kilo: SupportedKiloSummary;
  ok: true;
}

export type KiloDetectionResult = KiloDetectionBlocked | SupportedKiloDetection;

const KILO_VERSION_PATTERN = /\b(\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?)\b/u;
const DEFAULT_KILO_COMPATIBILITY_PROFILES = Object.freeze([
  KILO_COMPATIBILITY_PROFILE_7_2_0,
] as const satisfies readonly KiloCompatibilityProfile[]);

export function parseKiloVersion(output: string): string | null {
  const versionMatch = output.match(KILO_VERSION_PATTERN);

  if (versionMatch === null) {
    return null;
  }

  return valid(versionMatch[1]);
}

export function resolveSupportedKiloProfile(
  installedVersion: string,
  profiles: readonly KiloCompatibilityProfile[] = DEFAULT_KILO_COMPATIBILITY_PROFILES,
): KiloCompatibilityProfile | undefined {
  return profiles.find(
    (profile) => profile.supportedVersion === installedVersion,
  );
}

export async function detectInstalledKilo(
  dependencies: InstallDependencies,
  profiles: readonly KiloCompatibilityProfile[] = DEFAULT_KILO_COMPATIBILITY_PROFILES,
): Promise<KiloDetectionResult> {
  const resolvedCommand = await resolveInstalledKiloCommand(dependencies);

  if (resolvedCommand === undefined) {
    return {
      errorCode: "kilo_not_found",
      message:
        "Kilo CLI was not found on PATH. Install @kilocode/cli@7.2.0 and rerun npx @gonkagate/kilo-setup.",
      ok: false,
    };
  }

  const versionResult = await dependencies.commands
    .run(resolvedCommand, ["--version"], {
      cwd: dependencies.runtime.cwd,
      env: dependencies.runtime.env,
    })
    .catch(() => undefined);

  if (versionResult === undefined || versionResult.exitCode !== 0) {
    return createBlockedVersionResult(
      "kilo_version_unparseable",
      resolvedCommand,
      undefined,
      versionResult?.signal ?? null,
    );
  }

  const rawVersionOutput =
    `${versionResult.stdout}\n${versionResult.stderr}`.trim();
  const installedVersion = parseKiloVersion(rawVersionOutput);

  if (installedVersion === null) {
    return createBlockedVersionResult(
      "kilo_version_unparseable",
      resolvedCommand,
    );
  }

  const profile = resolveSupportedKiloProfile(installedVersion, profiles);

  if (profile === undefined) {
    return createBlockedVersionResult(
      "kilo_version_unsupported",
      resolvedCommand,
      installedVersion,
    );
  }

  return {
    kilo: {
      command: resolvedCommand,
      installedVersion,
      profileId: profile.id as SupportedKiloSummary["profileId"],
    },
    ok: true,
  };
}

async function resolveInstalledKiloCommand(
  dependencies: InstallDependencies,
): Promise<KiloCommandName | undefined> {
  for (const command of [
    KILO_PRIMARY_COMMAND,
    KILO_FALLBACK_COMMAND,
  ] as const) {
    const result = await dependencies.commands
      .run(command, ["--version"], {
        cwd: dependencies.runtime.cwd,
        env: dependencies.runtime.env,
      })
      .then((value) => value)
      .catch((error: unknown) => {
        if (isCommandNotFoundError(error)) {
          return undefined;
        }

        throw error;
      });

    if (result !== undefined) {
      return command;
    }
  }

  return undefined;
}

function createBlockedVersionResult(
  errorCode: Extract<
    InstallFlowErrorCode,
    "kilo_version_unparseable" | "kilo_version_unsupported"
  >,
  command: KiloCommandName,
  installedVersion?: string,
  signal?: NodeJS.Signals | null,
): KiloDetectionBlocked {
  if (errorCode === "kilo_version_unsupported") {
    const commandPrefix =
      command === KILO_FALLBACK_COMMAND
        ? "Detected fallback Kilo alias"
        : "Detected Kilo CLI";

    return {
      errorCode,
      kilo: {
        command,
        installedVersion,
      },
      message: `${commandPrefix} ${command} ${installedVersion ?? "unknown"}, but only exact @kilocode/cli@7.2.0 is supported right now.`,
      ok: false,
    };
  }

  const fallbackNote =
    command === KILO_FALLBACK_COMMAND ? " via the fallback kilocode alias" : "";
  const signalNote =
    signal === null || signal === undefined ? "" : ` Signal: ${signal}.`;

  return {
    errorCode,
    kilo: {
      command,
      installedVersion,
    },
    message: `Could not determine the installed Kilo version from \`${command} --version\`${fallbackNote}.${signalNote} Install exact @kilocode/cli@7.2.0 or repair the local Kilo CLI and rerun npx @gonkagate/kilo-setup.`,
    ok: false,
  };
}

function isCommandNotFoundError(error: unknown): boolean {
  if (!(error instanceof Error)) {
    return false;
  }

  const commandError = error as NodeJS.ErrnoException;

  return (
    commandError.code === "ENOENT" ||
    /spawn .* ENOENT/u.test(commandError.message)
  );
}
