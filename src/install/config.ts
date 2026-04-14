import { applyEdits, modify, type FormattingOptions } from "jsonc-parser";
import type {
  ManagedConfigDocument,
  ManagedConfigMutation,
  ManagedConfigTarget,
} from "./contracts/managed-config.js";
import type { ManagedArtifactWriteResult } from "./contracts/managed-artifact.js";
import type { InstallDependencies } from "./deps.js";
import { createInstallError } from "./errors.js";
import {
  detectConfigDocumentEndOfLine,
  ensureTrailingConfigDocumentNewline,
  formatConfigPath,
  tryParseJsoncObject,
} from "./jsonc.js";
import { replaceManagedTextFile } from "./managed-files.js";

type ManagedConfigMutationDocument<
  TTarget extends ManagedConfigTarget = ManagedConfigTarget,
> = Pick<
  ManagedConfigDocument<TTarget>,
  "contents" | "eol" | "path" | "target"
>;

export async function readManagedConfigDocument<
  TTarget extends ManagedConfigTarget,
>(
  target: TTarget,
  targetPath: string,
  dependencies: InstallDependencies,
): Promise<ManagedConfigDocument<TTarget>> {
  const exists = await dependencies.fs.pathExists(targetPath);

  if (!exists) {
    return {
      contents: "",
      eol: "\n",
      exists: false,
      initialValue: {},
      path: targetPath,
      target,
    };
  }

  const contents = await dependencies.fs.readFile(targetPath, "utf8");

  return {
    contents,
    eol: detectConfigDocumentEndOfLine(contents),
    exists: true,
    initialValue: parseManagedConfigObject(contents, target, targetPath),
    path: targetPath,
    target,
  };
}

export function applyManagedConfigMutations(
  document: ManagedConfigMutationDocument,
  mutations: readonly ManagedConfigMutation[],
): string {
  if (mutations.length === 0) {
    return document.contents.length === 0
      ? document.contents
      : ensureTrailingConfigDocumentNewline(document.contents, document.eol);
  }

  let updatedContents = document.contents;
  const formattingOptions: FormattingOptions = {
    eol: document.eol,
    insertSpaces: true,
    tabSize: 2,
  };

  for (const mutation of mutations) {
    updatedContents = applyMutation(
      updatedContents,
      document,
      mutation,
      formattingOptions,
    );
  }

  return ensureTrailingConfigDocumentNewline(updatedContents, document.eol);
}

export async function writeManagedConfigDocument(request: {
  backupDirectoryPath: string;
  document: ManagedConfigDocument;
  nextContents: string;
  dependencies: InstallDependencies;
}): Promise<{
  backupPath?: string;
  changed: boolean;
  created: boolean;
  path: string;
  rollbackAction: ManagedArtifactWriteResult["rollbackAction"];
}> {
  if (
    request.document.exists &&
    request.document.contents === request.nextContents
  ) {
    return {
      changed: false,
      created: false,
      path: request.document.path,
      backupPath: undefined,
      rollbackAction: undefined,
    };
  }

  return await replaceManagedTextFile(
    {
      backupDirectoryPath: request.backupDirectoryPath,
      contents: request.nextContents,
      mapBackupError: (cause) =>
        createInstallError("managed_config_backup_failed", {
          cause,
          path: request.document.path,
          target: request.document.target,
        }),
      mapWriteError: (cause) =>
        createInstallError("managed_config_write_failed", {
          cause,
          path: request.document.path,
          target: request.document.target,
        }),
      path: request.document.path,
    },
    request.dependencies,
  );
}

function applyMutation(
  currentContents: string,
  document: ManagedConfigMutationDocument,
  mutation: ManagedConfigMutation,
  formattingOptions: FormattingOptions,
): string {
  try {
    const edits = modify(
      currentContents,
      [...mutation.path],
      mutation.kind === "delete" ? undefined : mutation.value,
      { formattingOptions },
    );

    return applyEdits(currentContents, edits);
  } catch (cause) {
    throw createInstallError("managed_config_merge_failed", {
      keyPath: formatConfigPath(mutation.path),
      path: document.path,
      reason: cause instanceof Error ? cause.message : String(cause),
      target: document.target,
    });
  }
}

function parseManagedConfigObject(
  contents: string,
  target: ManagedConfigTarget,
  targetPath: string,
): Record<string, unknown> {
  const result = tryParseJsoncObject(contents);

  if (!result.ok) {
    throw createInstallError("managed_config_parse_failed", {
      path: targetPath,
      reason: result.error.reason,
      target,
    });
  }

  return result.value;
}
