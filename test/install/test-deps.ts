import {
  createNodeInstallDependencies,
  type CreateInstallDependenciesOverrides,
  type InstallClock,
  type InstallCommandResult,
  type InstallCommandRunner,
  type InstallDependencies,
  type InstallFs,
  type InstallInput,
  type InstallPrompts,
  type InstallRuntimeEnvironment,
  type InstallRuntimeOverrides,
  type InstallSelectOptions,
} from "../../src/install/deps.js";
import type { InstallModelCatalog } from "../../src/install/model-catalog.js";
import {
  getInstallPathApi,
  normalizeInstallPath,
} from "../../src/install/platform-path.js";

interface StubCommandSuccess {
  kind: "result";
  result: InstallCommandResult;
}

interface StubCommandFailure {
  error: Error;
  kind: "error";
}

type StubCommandBehavior = StubCommandFailure | StubCommandSuccess;

type StubConfig<TOptions extends object = {}> = {
  kind: "stub";
} & TOptions;

type OverrideConfig<TDependency> = {
  kind: "override";
  value: Partial<TDependency>;
};

type TestDependencyConfig<TDependency, TStubOptions extends object = {}> =
  | StubConfig<TStubOptions>
  | OverrideConfig<TDependency>;

type TestInstallClockConfig = TestDependencyConfig<
  InstallClock,
  { now?: Date }
>;
type TestInstallInputConfig = TestDependencyConfig<
  InstallInput,
  { stdinText?: string }
>;
type TestInstallModelCatalogConfig = OverrideConfig<InstallModelCatalog>;
type TestInstallPromptsConfig = TestDependencyConfig<
  InstallPrompts,
  {
    error?: unknown;
    selections?: string[];
    secret?: string;
  }
>;

export interface TestInstallDependencyOverrides {
  clock?: TestInstallClockConfig;
  commandBehaviors?: Partial<Record<string, StubCommandBehavior>>;
  existingPaths?: readonly string[];
  seedDirectories?: readonly TestInstallFsDirectorySeed[];
  seedFiles?: readonly TestInstallFsFileSeed[];
  fs?: Partial<InstallFs>;
  input?: TestInstallInputConfig;
  models?: TestInstallModelCatalogConfig;
  prompts?: TestInstallPromptsConfig;
  runtime?: InstallRuntimeOverrides;
}

export interface TestInstallFsDirectorySeed {
  mode?: number;
  path: string;
}

export interface TestInstallFsFileSeed {
  contents?: string;
  mode?: number;
  path: string;
}

interface InMemoryDirectoryEntry {
  kind: "directory";
  mode?: number;
}

interface InMemoryFileEntry {
  contents: string;
  kind: "file";
  mode?: number;
}

type InMemoryInstallFsEntry = InMemoryDirectoryEntry | InMemoryFileEntry;

export interface StubInstallFs extends InstallFs {
  getEntry(path: string): InMemoryInstallFsEntry | undefined;
  readText(path: string): string | undefined;
  seedDirectory(path: string, mode?: number): void;
  seedFile(path: string, contents?: string, mode?: number): void;
}

const DEFAULT_TEST_INSTALL_RUNTIME: InstallRuntimeEnvironment = {
  cwd: "/workspace/project",
  env: {},
  homeDir: "/home/test",
  platform: "linux",
  stdinIsTTY: false,
  stdoutIsTTY: false,
};

export function createStubInstallFs(
  options: {
    directories?: readonly TestInstallFsDirectorySeed[];
    existingPaths?: readonly string[];
    files?: readonly TestInstallFsFileSeed[];
    platform?: NodeJS.Platform;
  } = {},
): StubInstallFs {
  const entries = new Map<string, InMemoryInstallFsEntry>();
  const platform = options.platform ?? "linux";
  const pathApi = getInstallPathApi(platform);

  function normalizePath(pathValue: string): string {
    return pathApi.resolve(normalizeInstallPath(pathValue, platform));
  }

  function ensureRootEntry(pathValue: string): void {
    const rootPath = pathApi.parse(pathValue).root;

    if (rootPath.length > 0 && !entries.has(rootPath)) {
      entries.set(rootPath, {
        kind: "directory",
      });
    }
  }

  function createParentDirectories(pathValue: string): void {
    const normalizedPath = normalizePath(pathValue);
    const rootPath = pathApi.parse(normalizedPath).root;
    let currentPath = pathApi.dirname(normalizedPath);
    const missingDirectories: string[] = [];

    ensureRootEntry(normalizedPath);

    while (currentPath !== rootPath) {
      missingDirectories.push(currentPath);
      currentPath = pathApi.dirname(currentPath);
    }

    if (rootPath.length > 0) {
      missingDirectories.push(rootPath);
    }

    for (const directoryPath of missingDirectories.reverse()) {
      const existingEntry = entries.get(directoryPath);

      if (existingEntry !== undefined && existingEntry.kind !== "directory") {
        throw new Error(`ENOTDIR: ${directoryPath}`);
      }

      if (existingEntry === undefined) {
        entries.set(directoryPath, {
          kind: "directory",
        });
      }
    }
  }

  function assertWritableParentDirectory(pathValue: string): void {
    const normalizedPath = normalizePath(pathValue);
    const parentPath = pathApi.dirname(normalizedPath);

    ensureRootEntry(normalizedPath);
    const parentEntry = entries.get(parentPath);

    if (parentEntry === undefined) {
      throw new Error(`ENOENT: ${parentPath}`);
    }

    if (parentEntry.kind !== "directory") {
      throw new Error(`ENOTDIR: ${parentPath}`);
    }
  }

  function normalizeFileContents(
    data: string | Uint8Array,
    encoding?: BufferEncoding,
  ): string {
    if (typeof data === "string") {
      return data;
    }

    return Buffer.from(data).toString(encoding ?? "utf8");
  }

  function writeFileEntry(
    pathValue: string,
    data: string | Uint8Array,
    options?: {
      encoding?: BufferEncoding;
      mode?: number;
    },
  ): void {
    const normalizedPath = normalizePath(pathValue);
    const previousEntry = entries.get(normalizedPath);

    assertWritableParentDirectory(normalizedPath);

    entries.set(normalizedPath, {
      contents: normalizeFileContents(data, options?.encoding),
      kind: "file",
      mode: options?.mode ?? previousEntry?.mode,
    });
  }

  function seedDirectory(pathValue: string, mode?: number): void {
    const normalizedPath = normalizePath(pathValue);
    const existingEntry = entries.get(normalizedPath);

    createParentDirectories(normalizedPath);

    if (existingEntry !== undefined && existingEntry.kind !== "directory") {
      throw new Error(`ENOTDIR: ${normalizedPath}`);
    }

    entries.set(normalizedPath, {
      kind: "directory",
      mode: mode ?? existingEntry?.mode,
    });
  }

  function seedFile(pathValue: string, contents = "", mode?: number): void {
    const normalizedPath = normalizePath(pathValue);
    const existingEntry = entries.get(normalizedPath);

    createParentDirectories(normalizedPath);

    if (existingEntry !== undefined && existingEntry.kind === "directory") {
      throw new Error(`EISDIR: ${normalizedPath}`);
    }

    entries.set(normalizedPath, {
      contents,
      kind: "file",
      mode: mode ?? existingEntry?.mode,
    });
  }

  for (const directory of options.directories ?? []) {
    seedDirectory(directory.path, directory.mode);
  }

  for (const existingPath of options.existingPaths ?? []) {
    seedFile(existingPath);
  }

  for (const file of options.files ?? []) {
    seedFile(file.path, file.contents, file.mode);
  }

  return {
    async chmod(pathValue, mode) {
      const normalizedPath = normalizePath(pathValue);
      const existingEntry = entries.get(normalizedPath);

      if (existingEntry === undefined) {
        throw new Error(`ENOENT: ${pathValue}`);
      }

      existingEntry.mode = mode;
    },
    getEntry(pathValue) {
      const entry = entries.get(normalizePath(pathValue));

      return entry === undefined ? undefined : { ...entry };
    },
    async mkdir(pathValue, options) {
      if (options?.recursive) {
        seedDirectory(pathValue, options.mode);
        return;
      }

      const normalizedPath = normalizePath(pathValue);
      assertWritableParentDirectory(normalizedPath);

      const existingEntry = entries.get(normalizedPath);

      if (existingEntry !== undefined && existingEntry.kind !== "directory") {
        throw new Error(`EEXIST: ${normalizedPath}`);
      }

      entries.set(normalizedPath, {
        kind: "directory",
        mode: options?.mode ?? existingEntry?.mode,
      });
    },
    async pathExists(pathValue) {
      return entries.has(normalizePath(pathValue));
    },
    async readFile(pathValue) {
      const entry = entries.get(normalizePath(pathValue));

      if (entry === undefined) {
        throw new Error(`ENOENT: ${pathValue}`);
      }

      if (entry.kind !== "file") {
        throw new Error(`EISDIR: ${pathValue}`);
      }

      return entry.contents;
    },
    async removeFile(pathValue) {
      const normalizedPath = normalizePath(pathValue);
      const entry = entries.get(normalizedPath);

      if (entry === undefined) {
        throw new Error(`ENOENT: ${pathValue}`);
      }

      if (entry.kind !== "file") {
        throw new Error(`EISDIR: ${pathValue}`);
      }

      entries.delete(normalizedPath);
    },
    readText(pathValue) {
      const entry = entries.get(normalizePath(pathValue));

      return entry?.kind === "file" ? entry.contents : undefined;
    },
    seedDirectory,
    seedFile,
    async writeFile(pathValue, data, options) {
      writeFileEntry(pathValue, data, options);
    },
    async writeFileAtomic(pathValue, data, options) {
      writeFileEntry(pathValue, data, options);
    },
  };
}

export function createTestInstallRuntime(
  overrides: InstallRuntimeOverrides = {},
): InstallRuntimeEnvironment {
  return {
    cwd: overrides.cwd ?? DEFAULT_TEST_INSTALL_RUNTIME.cwd,
    env: { ...DEFAULT_TEST_INSTALL_RUNTIME.env, ...overrides.env },
    homeDir: overrides.homeDir ?? DEFAULT_TEST_INSTALL_RUNTIME.homeDir,
    platform: overrides.platform ?? DEFAULT_TEST_INSTALL_RUNTIME.platform,
    stdinIsTTY: overrides.stdinIsTTY ?? DEFAULT_TEST_INSTALL_RUNTIME.stdinIsTTY,
    stdoutIsTTY:
      overrides.stdoutIsTTY ?? DEFAULT_TEST_INSTALL_RUNTIME.stdoutIsTTY,
  };
}

export function createStubInstallClock(
  now = new Date("2026-04-14T00:00:00.000Z"),
): InstallClock {
  return {
    now: () => now,
  };
}

export function createStubInstallInput(stdinText = ""): InstallInput {
  return {
    async readStdin() {
      return stdinText;
    },
  };
}

export function createStubInstallPrompts(
  options: {
    error?: unknown;
    selections?: string[];
    secret?: string;
  } = {},
): InstallPrompts {
  const queuedSelections = [...(options.selections ?? [])];

  return {
    async readSecret() {
      if (options.error !== undefined) {
        throw options.error;
      }

      return options.secret ?? "";
    },
    async selectOption<TValue extends string>(
      selectOptions: InstallSelectOptions<TValue>,
    ): Promise<TValue> {
      if (options.error !== undefined) {
        throw options.error;
      }

      const queuedSelection = queuedSelections.shift();

      if (queuedSelection !== undefined) {
        return queuedSelection as TValue;
      }

      return (selectOptions.defaultValue ??
        selectOptions.choices[0]?.value) as TValue;
    },
  };
}

export function createStubCommandRunnerFromBehaviorMap(
  behaviors: Partial<Record<string, StubCommandBehavior>>,
): InstallCommandRunner {
  return {
    async run(command, args) {
      const key = `${command} ${args.join(" ")}`.trim();
      const behavior = behaviors[key];

      if (behavior === undefined) {
        throw Object.assign(new Error(`spawn ${command} ENOENT`), {
          code: "ENOENT",
          path: command,
        });
      }

      if (behavior.kind === "error") {
        throw behavior.error;
      }

      return behavior.result;
    },
  };
}

export function createStubbedTestInstallDependencies(
  overrides: TestInstallDependencyOverrides = {},
): InstallDependencies {
  const runtime = createTestInstallRuntime(overrides.runtime);
  const stubFs = createStubInstallFs({
    directories: overrides.seedDirectories,
    existingPaths: overrides.existingPaths,
    files: overrides.seedFiles,
    platform: runtime.platform,
  });
  const installOverrides: CreateInstallDependenciesOverrides = {
    clock:
      overrides.clock?.kind === "override"
        ? overrides.clock.value
        : createStubInstallClock(overrides.clock?.now),
    commands: createStubCommandRunnerFromBehaviorMap(
      overrides.commandBehaviors ?? {},
    ),
    fs: overrides.fs === undefined ? stubFs : { ...stubFs, ...overrides.fs },
    input:
      overrides.input?.kind === "override"
        ? overrides.input.value
        : createStubInstallInput(overrides.input?.stdinText),
    models:
      overrides.models?.kind === "override"
        ? overrides.models.value
        : undefined,
    prompts:
      overrides.prompts?.kind === "override"
        ? overrides.prompts.value
        : createStubInstallPrompts({
            error: overrides.prompts?.error,
            selections: overrides.prompts?.selections,
            secret: overrides.prompts?.secret,
          }),
    runtime,
  };

  return createNodeInstallDependencies(installOverrides);
}

export function createTestInstallDependencies(
  behaviors: Partial<Record<string, StubCommandBehavior>> = {},
): InstallDependencies {
  return createStubbedTestInstallDependencies({
    commandBehaviors: behaviors,
  });
}
