import { spawn } from "node:child_process";
import { constants } from "node:fs";
import {
  access,
  chmod as chmodFs,
  mkdtemp as mkdtempFs,
  mkdir as mkdirFs,
  readFile as readFileFs,
  rm as rmFs,
  writeFile as writeFileFs,
} from "node:fs/promises";
import os from "node:os";
import process from "node:process";
import { password, select } from "@inquirer/prompts";
import writeFileAtomic from "write-file-atomic";
import {
  createDefaultInstallModelCatalog,
  type InstallModelCatalog,
} from "./model-catalog.js";

export interface InstallCommandOptions {
  cwd?: string;
  env?: NodeJS.ProcessEnv;
}

export interface InstallCommandResult {
  exitCode: number;
  signal: NodeJS.Signals | null;
  stderr: string;
  stdout: string;
}

export interface InstallFs {
  chmod(path: string, mode: number): Promise<void>;
  mkdtemp(prefix: string): Promise<string>;
  mkdir(
    path: string,
    options?: {
      mode?: number;
      recursive?: boolean;
    },
  ): Promise<void>;
  pathExists(path: string): Promise<boolean>;
  readFile(path: string, encoding: BufferEncoding): Promise<string>;
  removeDirectory(
    path: string,
    options?: {
      force?: boolean;
      recursive?: boolean;
    },
  ): Promise<void>;
  removeFile(path: string): Promise<void>;
  writeFile(
    path: string,
    data: string | Uint8Array,
    options?: {
      encoding?: BufferEncoding;
      mode?: number;
    },
  ): Promise<void>;
  writeFileAtomic(
    path: string,
    data: string | Uint8Array,
    options?: {
      encoding?: BufferEncoding;
      mode?: number;
    },
  ): Promise<void>;
}

export interface InstallClock {
  now(): Date;
}

export interface InstallInput {
  readStdin(): Promise<string>;
}

export interface InstallSelectChoice<TValue extends string = string> {
  description?: string;
  label: string;
  value: TValue;
}

export interface InstallSelectOptions<TValue extends string = string> {
  choices: readonly InstallSelectChoice<TValue>[];
  defaultValue?: TValue;
  message: string;
  pageSize?: number;
}

export interface InstallPrompts {
  readSecret(message: string): Promise<string>;
  selectOption<TValue extends string>(
    options: InstallSelectOptions<TValue>,
  ): Promise<TValue>;
}

export interface InstallCommandRunner {
  run(
    command: string,
    args: readonly string[],
    options?: InstallCommandOptions,
  ): Promise<InstallCommandResult>;
}

export interface InstallRuntimeEnvironment {
  cwd: string;
  env: NodeJS.ProcessEnv;
  homeDir: string;
  platform: NodeJS.Platform;
  stdinIsTTY: boolean;
  tempDir: string;
  stdoutIsTTY: boolean;
}

export type InstallRuntimeOverrides = Partial<InstallRuntimeEnvironment>;

export interface InstallDependencies {
  clock: InstallClock;
  commands: InstallCommandRunner;
  fs: InstallFs;
  input: InstallInput;
  models: InstallModelCatalog;
  prompts: InstallPrompts;
  runtime: InstallRuntimeEnvironment;
}

export interface CreateInstallDependenciesOverrides {
  clock?: Partial<InstallClock>;
  commands?: Partial<InstallCommandRunner>;
  fs?: Partial<InstallFs>;
  input?: Partial<InstallInput>;
  models?: Partial<InstallModelCatalog>;
  prompts?: Partial<InstallPrompts>;
  runtime?: InstallRuntimeOverrides;
}

async function pathExists(path: string): Promise<boolean> {
  try {
    await access(path, constants.F_OK);
    return true;
  } catch {
    return false;
  }
}

async function mkdir(
  path: string,
  options?: {
    mode?: number;
    recursive?: boolean;
  },
): Promise<void> {
  await mkdirFs(path, options);
}

async function mkdtemp(prefix: string): Promise<string> {
  return await mkdtempFs(prefix);
}

async function readFile(
  path: string,
  encoding: BufferEncoding,
): Promise<string> {
  return await readFileFs(path, encoding);
}

async function removeFile(path: string): Promise<void> {
  await rmFs(path, {
    force: false,
  });
}

async function removeDirectory(
  path: string,
  options?: {
    force?: boolean;
    recursive?: boolean;
  },
): Promise<void> {
  await rmFs(path, {
    force: options?.force ?? false,
    recursive: options?.recursive ?? false,
  });
}

async function writeFile(
  path: string,
  data: string | Uint8Array,
  options?: {
    encoding?: BufferEncoding;
    mode?: number;
  },
): Promise<void> {
  await writeFileFs(path, data, options);
}

async function writeFileAtomically(
  path: string,
  data: string | Uint8Array,
  options?: {
    encoding?: BufferEncoding;
    mode?: number;
  },
): Promise<void> {
  await writeFileAtomic(
    path,
    typeof data === "string" ? data : Buffer.from(data),
    options,
  );
}

async function chmod(path: string, mode: number): Promise<void> {
  await chmodFs(path, mode);
}

async function runInstallCommand(
  command: string,
  args: readonly string[],
  options: InstallCommandOptions = {},
): Promise<InstallCommandResult> {
  return await new Promise<InstallCommandResult>((resolve, reject) => {
    const child = spawn(command, [...args], {
      cwd: options.cwd,
      env: options.env,
      shell: process.platform === "win32",
      windowsHide: true,
    });

    let stdout = "";
    let stderr = "";

    child.stdout.setEncoding("utf8");
    child.stdout.on("data", (chunk: string) => {
      stdout += chunk;
    });

    child.stderr.setEncoding("utf8");
    child.stderr.on("data", (chunk: string) => {
      stderr += chunk;
    });

    child.on("error", reject);
    child.on("close", (exitCode, signal) => {
      resolve({
        exitCode: exitCode ?? 1,
        signal,
        stderr,
        stdout,
      });
    });
  });
}

async function readStdin(): Promise<string> {
  return await new Promise<string>((resolve, reject) => {
    let stdinText = "";

    process.stdin.setEncoding("utf8");
    process.stdin.on("data", (chunk: string) => {
      stdinText += chunk;
    });
    process.stdin.on("end", () => {
      resolve(stdinText);
    });
    process.stdin.on("error", reject);
  });
}

async function readSecret(message: string): Promise<string> {
  return await password({
    mask: "*",
    message,
  });
}

async function selectOption<TValue extends string>(
  options: InstallSelectOptions<TValue>,
): Promise<TValue> {
  return await select<TValue>({
    choices: options.choices.map((choice) => ({
      description: choice.description,
      name: choice.label,
      value: choice.value,
    })),
    default: options.defaultValue,
    message: options.message,
    pageSize: options.pageSize,
  });
}

const DEFAULT_INSTALL_FS: InstallFs = {
  chmod,
  mkdtemp,
  mkdir,
  pathExists,
  readFile,
  removeDirectory,
  removeFile,
  writeFile,
  writeFileAtomic: writeFileAtomically,
};

const DEFAULT_INSTALL_CLOCK: InstallClock = {
  now: () => new Date(),
};

const DEFAULT_INSTALL_INPUT: InstallInput = {
  readStdin,
};

const DEFAULT_INSTALL_PROMPTS: InstallPrompts = {
  readSecret,
  selectOption,
};
const DEFAULT_INSTALL_MODELS = createDefaultInstallModelCatalog();

const DEFAULT_INSTALL_COMMANDS: InstallCommandRunner = {
  run: runInstallCommand,
};

export function createNodeInstallDependencies(
  overrides: CreateInstallDependenciesOverrides = {},
): InstallDependencies {
  return {
    clock: { ...DEFAULT_INSTALL_CLOCK, ...overrides.clock },
    commands: { ...DEFAULT_INSTALL_COMMANDS, ...overrides.commands },
    fs: { ...DEFAULT_INSTALL_FS, ...overrides.fs },
    input: { ...DEFAULT_INSTALL_INPUT, ...overrides.input },
    models: { ...DEFAULT_INSTALL_MODELS, ...overrides.models },
    prompts: { ...DEFAULT_INSTALL_PROMPTS, ...overrides.prompts },
    runtime: {
      cwd: overrides.runtime?.cwd ?? process.cwd(),
      env: overrides.runtime?.env ?? process.env,
      homeDir: overrides.runtime?.homeDir ?? os.homedir(),
      platform: overrides.runtime?.platform ?? process.platform,
      stdinIsTTY: overrides.runtime?.stdinIsTTY ?? process.stdin.isTTY ?? false,
      tempDir: overrides.runtime?.tempDir ?? os.tmpdir(),
      stdoutIsTTY:
        overrides.runtime?.stdoutIsTTY ?? process.stdout.isTTY ?? false,
    },
  };
}
