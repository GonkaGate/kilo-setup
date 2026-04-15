import type { CuratedModelKey } from "../constants/models.js";
import type {
  EffectiveConfigVerificationBlocker,
  EffectiveConfigVerificationMismatch,
  EffectiveConfigVerificationSuccess,
} from "./contracts/effective-config.js";
import type { InstallScope, KiloCommandName } from "./contracts.js";
import type { InstallDependencies } from "./deps.js";
import { createResolvedConfigVerificationPolicy } from "./effective-config-policy.js";
import { createInstallError } from "./errors.js";
import { tryParseJsoncObject } from "./jsonc.js";
import { runKiloOracle } from "./kilo-oracle.js";
import type { ManagedPaths } from "./paths.js";
import {
  inspectSecretBindingVerificationLayers,
  inspectVerificationLayers,
  resolveCurrentSessionLocalKiloConfig,
  resolveDurableLocalKiloConfig,
  selectHighestPrecedenceInspectableBlockers,
  type VerificationLayerInspectionRequest,
} from "./verify-layers.js";
import { collectValueCheckMismatches } from "./verification-mismatches.js";

export interface EffectiveKiloConfigVerificationRequest {
  kiloCommand: KiloCommandName;
  managedPaths: ManagedPaths;
  model: CuratedModelKey;
  projectRoot: string;
  scope: InstallScope;
}

export async function verifyEffectiveKiloConfig(
  request: EffectiveKiloConfigVerificationRequest,
  dependencies: InstallDependencies,
): Promise<EffectiveConfigVerificationSuccess> {
  const verificationRequest = toLayerInspectionRequest(request);
  const verificationPolicy = createResolvedConfigVerificationPolicy(
    request.model,
  );
  const durableResolution = await resolveDurableLocalKiloConfig(
    verificationRequest,
    dependencies,
  );
  const layerBlockers = selectHighestPrecedenceInspectableBlockers([
    ...(await inspectVerificationLayers(verificationRequest, dependencies)),
    ...(await inspectSecretBindingVerificationLayers(
      verificationRequest,
      dependencies,
    )),
  ]);

  if (layerBlockers.length > 0) {
    throw createInstallError("effective_config_blocked", {
      blockers: layerBlockers,
      target: verificationPolicy.target,
    });
  }

  const durableMismatches = collectValueCheckMismatches(
    durableResolution.resolvedConfig,
    verificationPolicy.valueChecks,
  );

  if (durableMismatches.length > 0) {
    throw createInstallError("effective_config_mismatch", {
      mismatches: durableMismatches,
      target: verificationPolicy.target,
    });
  }

  const oracleOutput = await runKiloOracle(
    {
      commandName: request.kiloCommand,
      layers: durableResolution.layers,
      managedPaths: request.managedPaths,
      projectRoot: request.projectRoot,
    },
    dependencies,
  );
  const oracleConfig = parseOracleOutput(oracleOutput);
  const oracleMismatches = collectValueCheckMismatches(
    oracleConfig,
    verificationPolicy.valueChecks,
  );

  if (oracleMismatches.length > 0) {
    throw createInstallError("effective_config_blocked", {
      blockers: [createInferredNonLocalBlocker(oracleMismatches[0])],
      target: verificationPolicy.target,
    });
  }

  return {
    blockers: [],
    ok: true,
    resolvedMatch: true,
    target: verificationPolicy.target,
  };
}

export async function verifyCurrentSessionKiloConfig(
  request: Omit<EffectiveKiloConfigVerificationRequest, "kiloCommand">,
  dependencies: InstallDependencies,
): Promise<EffectiveConfigVerificationSuccess> {
  const verificationRequest = toLayerInspectionRequest({
    ...request,
    kiloCommand: "kilo",
  });
  const verificationPolicy = createResolvedConfigVerificationPolicy(
    request.model,
  );
  const layerBlockers = selectHighestPrecedenceInspectableBlockers([
    ...(await inspectVerificationLayers(verificationRequest, dependencies, {
      includeConfigContent: true,
    })),
    ...(await inspectSecretBindingVerificationLayers(
      verificationRequest,
      dependencies,
      {
        includeConfigContent: true,
      },
    )),
  ]);

  if (layerBlockers.length > 0) {
    throw createInstallError("effective_config_blocked", {
      blockers: layerBlockers,
      target: verificationPolicy.target,
    });
  }

  const currentSessionResolution = await resolveCurrentSessionLocalKiloConfig(
    verificationRequest,
    dependencies,
  );
  const mismatches = collectValueCheckMismatches(
    currentSessionResolution.resolvedConfig,
    verificationPolicy.valueChecks,
  );

  if (mismatches.length > 0) {
    throw createInstallError("effective_config_mismatch", {
      mismatches,
      target: verificationPolicy.target,
    });
  }

  return {
    blockers: [],
    ok: true,
    resolvedMatch: true,
    target: verificationPolicy.target,
  };
}

function toLayerInspectionRequest(
  request: EffectiveKiloConfigVerificationRequest,
): VerificationLayerInspectionRequest {
  return {
    managedPaths: request.managedPaths,
    model: request.model,
    projectRoot: request.projectRoot,
    providerId: "gonkagate",
    scope: request.scope,
  };
}

function parseOracleOutput(stdout: string): Record<string, unknown> {
  const parsed = tryParseJsoncObject(stdout);

  if (!parsed.ok) {
    throw createInstallError("effective_config_oracle_parse_failed", {
      reason: parsed.error.reason,
    });
  }

  return parsed.value;
}

function createInferredNonLocalBlocker(
  mismatch: EffectiveConfigVerificationMismatch | undefined,
): EffectiveConfigVerificationBlocker {
  return {
    key: mismatch?.key ?? "resolved_config",
    layer: "inferred_non_local",
    reason:
      "The sandboxed Kilo oracle diverged from the local resolver and no locally inspectable layer explains the winner. Inferred non-local Kilo influence remains.",
  };
}
