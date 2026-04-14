import { GONKAGATE_SECRET_ENV_VAR } from "../constants/gateway.js";
import type { ManagedArtifactWriteResult } from "./contracts/managed-artifact.js";
import {
  ALLOWED_SECRET_INPUTS,
  type AllowedSecretInput,
  SECRET_INTAKE_PLAN,
} from "./contracts/secret-intake.js";
import type { InstallDependencies } from "./deps.js";
import { createInstallError } from "./errors.js";
import {
  ensureManagedFileProtection,
  replaceManagedTextFile,
} from "./managed-files.js";
import type { ManagedPaths } from "./paths.js";

export { ALLOWED_SECRET_INPUTS as SAFE_SECRET_INPUTS };

export interface SecretIntakeRequest {
  apiKeyStdin: boolean;
}

export interface ResolvedSecretInput {
  secret: string;
  source: AllowedSecretInput;
}

export interface ManagedSecretWriteRequest {
  managedPaths: ManagedPaths;
  resolvedSecret: ResolvedSecretInput;
}

const SECRET_PROMPT_MESSAGE = "Enter your GonkaGate API key";

export function getSecretStorageContract() {
  return {
    managedSecretPath: "~/.gonkagate/kilo/api-key",
    safeInputs: ALLOWED_SECRET_INPUTS,
  };
}

export function getSecretIntakePlan() {
  return SECRET_INTAKE_PLAN;
}

export async function resolveSecretInput(
  request: SecretIntakeRequest,
  dependencies: InstallDependencies,
): Promise<ResolvedSecretInput> {
  if (request.apiKeyStdin) {
    const stdinSecret = normalizeSecretValue(
      await dependencies.input.readStdin(),
    );

    if (stdinSecret === undefined) {
      throw createInstallError("secret_stdin_empty", {
        source: "api_key_stdin",
      });
    }

    return {
      secret: stdinSecret,
      source: "api_key_stdin",
    };
  }

  const envSecret = normalizeSecretValue(
    getEnvironmentValue(dependencies.runtime.env, GONKAGATE_SECRET_ENV_VAR),
  );

  if (envSecret !== undefined) {
    return {
      secret: envSecret,
      source: "env",
    };
  }

  if (!canPromptForSecret(dependencies)) {
    throw createInstallError("secret_prompt_unavailable", {
      stdinIsTTY: dependencies.runtime.stdinIsTTY,
      stdoutIsTTY: dependencies.runtime.stdoutIsTTY,
    });
  }

  const promptedSecret = normalizeSecretValue(
    await dependencies.prompts.readSecret(SECRET_PROMPT_MESSAGE),
  );

  if (promptedSecret === undefined) {
    throw createInstallError("secret_source_unavailable", {
      source: "hidden_prompt",
    });
  }

  return {
    secret: promptedSecret,
    source: "hidden_prompt",
  };
}

export async function writeManagedSecret(
  request: ManagedSecretWriteRequest,
  dependencies: InstallDependencies,
): Promise<ManagedArtifactWriteResult> {
  const targetPath = request.managedPaths.secretPath;
  const existed = await dependencies.fs.pathExists(targetPath);

  if (existed) {
    const existingSecret = await dependencies.fs.readFile(targetPath, "utf8");

    if (existingSecret === request.resolvedSecret.secret) {
      await ensureManagedFileProtection(dependencies, targetPath);

      return {
        backupPath: undefined,
        changed: false,
        created: false,
        path: targetPath,
        rollbackAction: undefined,
      };
    }
  }

  return await replaceManagedTextFile(
    {
      contents: request.resolvedSecret.secret,
      mapBackupError: (cause) =>
        createInstallError("managed_secret_write_failed", {
          cause,
          source: request.resolvedSecret.source,
          target: "managed_secret",
        }),
      mapWriteError: (cause) =>
        createInstallError("managed_secret_write_failed", {
          cause,
          source: request.resolvedSecret.source,
          target: "managed_secret",
        }),
      path: targetPath,
    },
    dependencies,
  );
}

function normalizeSecretValue(
  rawValue: string | undefined,
): string | undefined {
  if (typeof rawValue !== "string") {
    return undefined;
  }

  const normalizedValue = rawValue.trim();

  return normalizedValue.length > 0 ? normalizedValue : undefined;
}

function canPromptForSecret(
  dependencies: Pick<InstallDependencies, "runtime">,
): boolean {
  return dependencies.runtime.stdinIsTTY && dependencies.runtime.stdoutIsTTY;
}

function getEnvironmentValue(
  env: NodeJS.ProcessEnv,
  key: string,
): string | undefined {
  const directValue = env[key];

  if (directValue !== undefined) {
    return directValue;
  }

  const normalizedKey = key.toLowerCase();

  for (const [candidateKey, value] of Object.entries(env)) {
    if (candidateKey.toLowerCase() === normalizedKey) {
      return value;
    }
  }

  return undefined;
}
