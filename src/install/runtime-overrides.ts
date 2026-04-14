import {
  KILO_CONFIG_CONTENT_ENV_VAR,
  KILO_CONFIG_DIR_ENV_VAR,
  KILO_CONFIG_ENV_VAR,
} from "./kilo.js";

const KILO_TERMINAL_ENV_VAR = "KILO_TERMINAL";

const KILO_RUNTIME_OVERRIDE_ENV_VARS = Object.freeze([
  KILO_CONFIG_ENV_VAR,
  KILO_CONFIG_DIR_ENV_VAR,
  KILO_CONFIG_CONTENT_ENV_VAR,
] as const satisfies readonly string[]);

export function hasCurrentSessionRuntimeOverrides(
  env: NodeJS.ProcessEnv,
): boolean {
  if (hasNonEmptyEnvValue(env[KILO_CONFIG_CONTENT_ENV_VAR])) {
    return true;
  }

  if (!isKiloTerminalSession(env)) {
    return false;
  }

  return KILO_RUNTIME_OVERRIDE_ENV_VARS.some((envVar) =>
    hasNonEmptyEnvValue(env[envVar]),
  );
}

export function stripKiloTerminalRuntimeOverrides(
  env: NodeJS.ProcessEnv,
): NodeJS.ProcessEnv {
  if (!isKiloTerminalSession(env)) {
    return env;
  }

  const nextEnv = { ...env };

  delete nextEnv[KILO_CONFIG_ENV_VAR];
  delete nextEnv[KILO_CONFIG_DIR_ENV_VAR];
  delete nextEnv[KILO_CONFIG_CONTENT_ENV_VAR];

  return nextEnv;
}

function isKiloTerminalSession(env: NodeJS.ProcessEnv): boolean {
  const value = env[KILO_TERMINAL_ENV_VAR];

  return value === "1" || value === "true";
}

function hasNonEmptyEnvValue(value: string | undefined): boolean {
  return value !== undefined && value.length > 0;
}
