import {
  KILO_CONFIG_CONTENT_ENV_VAR,
  KILO_CONFIG_ENV_VAR,
  KILO_DEBUG_CONFIG_COMMAND,
  KILO_DEBUG_CONFIG_PURE_SUPPORTED,
} from "./kilo.js";

export const KILO_VERIFICATION_NOTES = Object.freeze([
  `${KILO_DEBUG_CONFIG_COMMAND} exists in the investigated Kilo baseline, but raw output must be treated as secret-bearing.`,
  `${KILO_DEBUG_CONFIG_COMMAND} --pure is not documented in the investigated Kilo baseline.`,
  `${KILO_CONFIG_ENV_VAR} and ${KILO_CONFIG_CONTENT_ENV_VAR} are Kilo override layers, not durable installer targets.`,
  "The curated Qwen default writes limit.output = 8192 because Kilo 7.2.0 requires a numeric output limit in custom model config.",
  "Support claims remain pinned to exact @kilocode/cli@7.2.0 even though the public default is now enabled.",
] as const);

export const KILO_VERIFICATION_PLACEHOLDER = {
  debugConfigPureSupported: KILO_DEBUG_CONFIG_PURE_SUPPORTED,
  notes: KILO_VERIFICATION_NOTES,
} as const;
