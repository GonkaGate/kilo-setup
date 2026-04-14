import type {
  CuratedModelKey,
  CuratedModelTransport,
} from "../../constants/models.js";
import type {
  RedactedDiagnosticData,
  RedactedDiagnosticValue,
} from "../redact.js";

export type EffectiveConfigVerificationBlockingLayer =
  | "KILO_CONFIG"
  | "KILO_CONFIG_CONTENT"
  | "KILO_CONFIG_DIR"
  | "global_config"
  | "home_directory_config"
  | "inferred_non_local"
  | "project_directory_config"
  | "project_root_config"
  | "system_managed_config";

export type EffectiveConfigVerificationFileBackedLayer = Exclude<
  EffectiveConfigVerificationBlockingLayer,
  "KILO_CONFIG_CONTENT" | "inferred_non_local"
>;

export type EffectiveConfigVerificationResolvedLayer = "resolved_config";

export type EffectiveConfigVerificationLayer =
  | EffectiveConfigVerificationBlockingLayer
  | EffectiveConfigVerificationResolvedLayer;

export interface EffectiveConfigVerificationFileLayerSource {
  kind: "file";
  layer: EffectiveConfigVerificationFileBackedLayer;
  path: string;
}

export interface EffectiveConfigVerificationInlineLayerSource {
  kind: "inline";
  layer: "KILO_CONFIG_CONTENT";
}

export type EffectiveConfigVerificationInputLayerSource =
  | EffectiveConfigVerificationFileLayerSource
  | EffectiveConfigVerificationInlineLayerSource;

export interface EffectiveConfigVerificationLayerSnapshot {
  config: Record<string, unknown>;
  source: EffectiveConfigVerificationInputLayerSource;
}

export interface EffectiveConfigVerificationTarget {
  modelKey: CuratedModelKey;
  modelRef: string;
  providerId: string;
  transport: CuratedModelTransport | "chat/completions";
}

export type EffectiveConfigDiagnosticData = RedactedDiagnosticData;
export type EffectiveConfigDiagnosticValue = RedactedDiagnosticValue;

interface EffectiveConfigVerificationIssue<
  TLayer extends EffectiveConfigVerificationLayer,
> {
  key: string;
  layer: TLayer;
  path?: string;
  reason: string;
}

export interface EffectiveConfigVerificationBlocker extends EffectiveConfigVerificationIssue<EffectiveConfigVerificationBlockingLayer> {}

export interface EffectiveConfigVerificationMismatch extends EffectiveConfigVerificationIssue<EffectiveConfigVerificationResolvedLayer> {
  actualValue: EffectiveConfigDiagnosticValue;
  expectedValue: EffectiveConfigDiagnosticValue;
}

export interface EffectiveConfigVerificationSuccess {
  blockers: readonly [];
  ok: true;
  resolvedMatch: true;
  target: EffectiveConfigVerificationTarget;
}
