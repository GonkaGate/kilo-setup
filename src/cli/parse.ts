import { Command, Option } from "commander";
import { CONTRACT_METADATA } from "../constants/contract.js";
import {
  CURRENT_TRANSPORT_TARGET,
  GONKAGATE_BASE_URL,
  GONKAGATE_PROVIDER_ID,
  GONKAGATE_SECRET_ENV_VAR,
} from "../constants/gateway.js";
import {
  KILO_CONFIG_CONTENT_ENV_VAR,
  KILO_CONFIG_ENV_VAR,
  KILO_FALLBACK_COMMAND,
  KILO_PREFERRED_GLOBAL_CONFIG,
  KILO_PREFERRED_PROJECT_CONFIG,
  KILO_PRIMARY_COMMAND,
} from "../install/kilo.js";
import type {
  CliOptions,
  CliRenderMode,
  InstallScope,
  ProgramOutput,
} from "./contracts.js";

interface ParsedProgramOptions {
  apiKeyStdin?: boolean;
  clearKiloModelCache?: boolean;
  cwd?: string;
  json?: boolean;
  model?: string;
  scope?: InstallScope;
  yes?: boolean;
}

export interface ParsedCliRequest {
  options: CliOptions;
  renderMode: CliRenderMode;
}

function toCliRenderMode(jsonOutputRequested: boolean): CliRenderMode {
  return jsonOutputRequested ? "json" : "human";
}

function rejectPlainApiKeyArgs(argv: string[]): void {
  if (argv.some((arg) => arg === "--api-key" || arg.startsWith("--api-key="))) {
    throw new Error(
      'Passing API keys via "--api-key" is intentionally unsupported. Use the hidden prompt, GONKAGATE_API_KEY, or --api-key-stdin instead.',
    );
  }
}

function createProgram(output?: ProgramOutput): Command {
  const program = new Command()
    .name(CONTRACT_METADATA.binName)
    .description("Configure Kilo to use GonkaGate.")
    .addOption(
      new Option(
        "--model <model-key>",
        "Choose a curated GonkaGate model key.",
      ),
    )
    .addOption(
      new Option(
        "--scope <scope>",
        "Choose whether GonkaGate should be activated for this machine or this project.",
      ).choices(["user", "project"]),
    )
    .addOption(
      new Option(
        "--cwd <path>",
        "Override the working directory used for project-scope path resolution.",
      ),
    )
    .addOption(
      new Option(
        "--api-key-stdin",
        "Read the GonkaGate API key from stdin.",
      ).default(false),
    )
    .addOption(
      new Option(
        "--clear-kilo-model-cache",
        "Clear Kilo's cached last-selected UI model after setup when possible.",
      ).default(false),
    )
    .addOption(
      new Option(
        "--yes",
        "Accept recommended non-interactive defaults when available.",
      ).default(false),
    )
    .addOption(
      new Option(
        "--json",
        "Emit machine-readable installer result output.",
      ).default(false),
    )
    .helpOption("-h, --help", "Show this help.")
    .version(
      CONTRACT_METADATA.cliVersion,
      "-v, --version",
      "Show the package version.",
    )
    .addHelpText(
      "after",
      `
Examples:
  ${CONTRACT_METADATA.publicEntrypoint}
  ${CONTRACT_METADATA.publicEntrypoint} --scope project --json
  ${CONTRACT_METADATA.publicEntrypoint} --clear-kilo-model-cache
  printf '%s' "$${GONKAGATE_SECRET_ENV_VAR}" | ${CONTRACT_METADATA.publicEntrypoint} --api-key-stdin --scope project --yes --json

Runtime status:
  The installer runtime is shipped for Kilo and currently defaults to the validated Qwen3 235B A22B Instruct 2507 FP8 profile for exact @kilocode/cli@7.2.0 installs.

Kilo contract anchors:
  - Primary command: ${KILO_PRIMARY_COMMAND}
  - Fallback command alias: ${KILO_FALLBACK_COMMAND}
  - Config env vars: ${KILO_CONFIG_ENV_VAR}, ${KILO_CONFIG_CONTENT_ENV_VAR}
  - Preferred global config: ${KILO_PREFERRED_GLOBAL_CONFIG}
  - Preferred project config: ${KILO_PREFERRED_PROJECT_CONFIG}
  - Provider id: ${GONKAGATE_PROVIDER_ID}
  - Base URL: ${GONKAGATE_BASE_URL}
  - Current transport target: ${CURRENT_TRANSPORT_TARGET}

Safe secret inputs:
  - hidden interactive prompt
  - ${GONKAGATE_SECRET_ENV_VAR}
  - --api-key-stdin
`,
    )
    .exitOverride();

  if (output) {
    program.configureOutput(output);
  }

  return program;
}

export function parseCliOptions(
  argv: string[],
  output?: ProgramOutput,
): CliOptions {
  rejectPlainApiKeyArgs(argv);

  const program = createProgram(output);
  program.parse(["node", CONTRACT_METADATA.binName, ...argv]);

  const options = program.opts<ParsedProgramOptions>();
  return {
    apiKeyStdin: options.apiKeyStdin ?? false,
    clearKiloModelCache: options.clearKiloModelCache ?? false,
    cwd: options.cwd,
    json: options.json ?? false,
    modelKey: options.model,
    scope: options.scope,
    yes: options.yes ?? false,
  };
}

export function inferFallbackCliRenderMode(
  argv: readonly string[],
): CliRenderMode {
  return toCliRenderMode(argv.includes("--json"));
}

export function parseCliRequest(
  argv: string[],
  output?: ProgramOutput,
): ParsedCliRequest {
  const options = parseCliOptions(argv, output);

  return {
    options,
    renderMode: toCliRenderMode(options.json),
  };
}
