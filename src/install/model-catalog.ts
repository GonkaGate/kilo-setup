import {
  getCuratedModelByKey,
  getRecommendedProductionDefaultModel,
  getValidatedModels,
  type CuratedModel,
  type RecommendedProductionDefaultCuratedModel,
  type ValidatedCuratedModel,
} from "../constants/models.js";

export interface InstallModelCatalog {
  getCuratedModelByKey(key: string): CuratedModel | undefined;
  getRecommendedProductionDefaultModel():
    | RecommendedProductionDefaultCuratedModel
    | undefined;
  getValidatedModels(): readonly ValidatedCuratedModel[];
}

const DEFAULT_INSTALL_MODEL_CATALOG: InstallModelCatalog = {
  getCuratedModelByKey,
  getRecommendedProductionDefaultModel,
  getValidatedModels,
};

export function createDefaultInstallModelCatalog(): InstallModelCatalog {
  return DEFAULT_INSTALL_MODEL_CATALOG;
}
