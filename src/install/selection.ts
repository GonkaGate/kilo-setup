import type {
  CuratedModelKey,
  ValidatedCuratedModel,
} from "../constants/models.js";
import { formatKiloModelRef } from "./managed-provider-config.js";
import type { InstallDependencies, InstallSelectChoice } from "./deps.js";
import { createInstallError } from "./errors.js";
import type { InstallScope } from "./contracts.js";

export interface ModelSelectionRequest {
  modelKey?: string;
  yes: boolean;
}

export interface ScopeSelectionRequest {
  insideGitRepository: boolean;
  scope?: InstallScope;
  yes: boolean;
}

export function canUseInteractiveInstallPrompts(
  dependencies: Pick<InstallDependencies, "runtime">,
): boolean {
  return dependencies.runtime.stdinIsTTY && dependencies.runtime.stdoutIsTTY;
}

export function getRecommendedInstallScope(
  insideGitRepository: boolean,
): InstallScope {
  return insideGitRepository ? "project" : "user";
}

export async function resolveInstallModel(
  request: ModelSelectionRequest,
  dependencies: InstallDependencies,
): Promise<ValidatedCuratedModel> {
  const validatedModels = dependencies.models.getValidatedModels();

  if (validatedModels.length === 0) {
    throw createInstallError("validated_models_unavailable", {});
  }

  if (request.modelKey !== undefined) {
    return requireValidatedModel(request.modelKey, dependencies);
  }

  const recommendedModel =
    dependencies.models.getRecommendedProductionDefaultModel();
  const singleValidatedModel =
    validatedModels.length === 1 ? validatedModels[0] : undefined;
  const defaultPromptModel =
    recommendedModel ?? singleValidatedModel ?? validatedModels[0];

  if (request.yes) {
    if (recommendedModel !== undefined) {
      return recommendedModel;
    }

    if (singleValidatedModel !== undefined) {
      return singleValidatedModel;
    }
  }

  if (!canUseInteractiveInstallPrompts(dependencies)) {
    if (recommendedModel !== undefined) {
      return recommendedModel;
    }

    if (singleValidatedModel !== undefined) {
      return singleValidatedModel;
    }

    throw createInstallError("model_selection_required", {
      validatedModelCount: validatedModels.length,
    });
  }

  const selectedModelKey = await dependencies.prompts.selectOption({
    choices: validatedModels.map((model) =>
      createModelChoice(model, defaultPromptModel),
    ),
    defaultValue: defaultPromptModel.key,
    message: "Choose the GonkaGate model to configure for Kilo",
    pageSize: Math.min(8, validatedModels.length),
  });

  return requireValidatedModel(selectedModelKey, dependencies);
}

export async function resolveInstallScope(
  request: ScopeSelectionRequest,
  dependencies: InstallDependencies,
): Promise<InstallScope> {
  if (request.scope !== undefined) {
    return request.scope;
  }

  const recommendedScope = getRecommendedInstallScope(
    request.insideGitRepository,
  );

  if (request.yes) {
    return recommendedScope;
  }

  if (!canUseInteractiveInstallPrompts(dependencies)) {
    throw createInstallError("scope_selection_required", {
      insideGitRepository: request.insideGitRepository,
    });
  }

  return await dependencies.prompts.selectOption({
    choices: createScopeChoices(recommendedScope, request.insideGitRepository),
    defaultValue: recommendedScope,
    message: "Where should GonkaGate be activated for Kilo on this machine?",
  });
}

function createModelChoice(
  model: ValidatedCuratedModel,
  defaultModel: ValidatedCuratedModel,
): InstallSelectChoice<CuratedModelKey> {
  return {
    description: `${formatKiloModelRef(model)} · validated`,
    label:
      model.key === defaultModel.key
        ? `${model.displayName} (Recommended)`
        : model.displayName,
    value: model.key,
  };
}

function createScopeChoices(
  recommendedScope: InstallScope,
  insideGitRepository: boolean,
): readonly InstallSelectChoice<InstallScope>[] {
  return [
    {
      description: insideGitRepository
        ? "Activate this repository for machines that have already run the installer. Project config stays secret-free."
        : "Activate only the current project by writing secret-free project settings.",
      label:
        recommendedScope === "project"
          ? "This repository (Recommended)"
          : "This repository",
      value: "project",
    },
    {
      description:
        "Activate GonkaGate in your user-level Kilo config for this machine.",
      label:
        recommendedScope === "user"
          ? "This machine (Recommended)"
          : "This machine",
      value: "user",
    },
  ];
}

function requireValidatedModel(
  modelKey: string,
  dependencies: InstallDependencies,
): ValidatedCuratedModel {
  const model = dependencies.models.getCuratedModelByKey(modelKey);

  if (model === undefined || model.validationStatus !== "validated") {
    throw createInstallError("unsupported_model_key", {
      modelKey,
    });
  }

  return model as ValidatedCuratedModel;
}
