import { CommanderError } from "commander";
import {
  redactSecretBearingText,
  redactSecretBearingValue,
} from "../install/redact.js";
import type {
  CliExecutionOutcome,
  CliExecutionResult,
  CliRenderMode,
} from "./contracts.js";
import type { InstallFlowResult } from "../install/contracts.js";
import type {
  EffectiveConfigVerificationBlocker,
  EffectiveConfigVerificationMismatch,
} from "../install/contracts/effective-config.js";

export function renderCliExecution(
  outcome: CliExecutionOutcome,
): CliExecutionResult {
  if (outcome.type === "result") {
    return finalizeCliExecution(outcome, {
      exitCode: outcome.result.status === "installed" ? 0 : 1,
      result: outcome.result,
      stdoutText: renderCliResult(outcome.result, outcome.renderMode),
    });
  }

  if (outcome.error instanceof CommanderError) {
    return finalizeCliExecution(outcome, {
      exitCode: outcome.error.exitCode,
    });
  }

  const renderedError = renderCliEntrypointError(outcome.error);

  if (outcome.renderMode === "json") {
    return finalizeCliExecution(outcome, {
      exitCode: renderedError.exitCode,
      stdoutText: `${JSON.stringify(
        {
          errorCode: "unexpected_error",
          message:
            renderedError.stderrText === undefined
              ? "Unexpected CLI failure."
              : stripEntrypointErrorPrefix(renderedError.stderrText),
          ok: false,
          status: "failed",
        },
        null,
        2,
      )}\n`,
    });
  }

  return finalizeCliExecution(outcome, {
    exitCode: renderedError.exitCode,
    stderrText: renderedError.stderrText,
  });
}

export function renderCliResult(
  result: InstallFlowResult,
  renderMode: CliRenderMode,
): string {
  if (renderMode === "json") {
    return `${JSON.stringify(redactSecretBearingValue(result), null, 2)}\n`;
  }

  return renderHumanResult(result);
}

export function formatUnexpectedCliErrorMessage(error: unknown): string {
  return redactSecretBearingText(
    error instanceof Error ? error.message : String(error),
  );
}

export interface CliEntrypointErrorRenderResult {
  exitCode: number;
  stderrText?: string;
}

export function renderCliEntrypointError(
  error: unknown,
): CliEntrypointErrorRenderResult {
  if (error instanceof CommanderError) {
    return {
      exitCode: error.exitCode,
    };
  }

  return {
    exitCode: 1,
    stderrText: `Error: ${formatUnexpectedCliErrorMessage(error)}\n`,
  };
}

function renderHumanResult(result: InstallFlowResult): string {
  if (result.status === "blocked") {
    const output = [
      "GonkaGate Kilo setup is blocked.",
      redactSecretBearingText(result.message),
    ];

    if (result.kilo !== undefined) {
      output.push(
        `Detected Kilo CLI: ${result.kilo.command} ${result.kilo.installedVersion ?? "unknown"}`,
      );
    }

    if (result.verificationTarget !== undefined) {
      output.push(`Verification target: ${result.verificationTarget.modelRef}`);
    }

    if ((result.blockers?.length ?? 0) > 0) {
      output.push("Blockers:");

      for (const blocker of result.blockers ?? []) {
        output.push(formatVerificationBlocker(blocker));
      }
    }

    if ((result.mismatches?.length ?? 0) > 0) {
      output.push("Mismatches:");

      for (const mismatch of result.mismatches ?? []) {
        output.push(formatVerificationMismatch(mismatch));
      }
    }

    output.push("");

    return output.join("\n");
  }

  if (result.status === "failed") {
    return [
      "GonkaGate Kilo setup failed.",
      redactSecretBearingText(result.message),
      "",
    ].join("\n");
  }

  if (result.status === "rolled_back") {
    return [
      "GonkaGate Kilo setup rolled back after a failed install attempt.",
      redactSecretBearingText(result.message),
      "",
    ].join("\n");
  }

  return [
    "GonkaGate is configured for Kilo.",
    `Detected Kilo CLI: ${result.kilo.command} ${result.kilo.installedVersion}`,
    `Model: ${result.modelRef}`,
    `Scope: ${result.scope}`,
    "Run kilo",
    "",
  ].join("\n");
}

function finalizeCliExecution(
  outcome: CliExecutionOutcome,
  options: {
    exitCode: number;
    result?: InstallFlowResult;
    stderrText?: string;
    stdoutText?: string;
  },
): CliExecutionResult {
  return {
    exitCode: options.exitCode,
    result: options.result,
    stderrText: mergeBufferedText(
      outcome.bufferedOutput.stderrText,
      options.stderrText,
    ),
    stdoutText: mergeBufferedText(
      outcome.bufferedOutput.stdoutText,
      options.stdoutText,
    ),
  };
}

function mergeBufferedText(
  existingText: string,
  nextText = "",
): string | undefined {
  const mergedText = `${existingText}${nextText}`;

  return mergedText === "" ? undefined : mergedText;
}

function stripEntrypointErrorPrefix(stderrText: string): string {
  return stderrText.replace(/^Error:\s*/u, "").trimEnd();
}

function formatVerificationBlocker(
  blocker: EffectiveConfigVerificationBlocker,
): string {
  const pathSuffix = blocker.path === undefined ? "" : ` (${blocker.path})`;

  return `- [${blocker.layer}${pathSuffix}] ${redactSecretBearingText(blocker.reason)}`;
}

function formatVerificationMismatch(
  mismatch: EffectiveConfigVerificationMismatch,
): string {
  return `- [${mismatch.key}] ${redactSecretBearingText(
    mismatch.reason,
  )} Expected ${formatDiagnosticValue(
    mismatch.expectedValue,
  )}; got ${formatDiagnosticValue(mismatch.actualValue)}.`;
}

function formatDiagnosticValue(value: unknown): string {
  return JSON.stringify(redactSecretBearingValue(value));
}
