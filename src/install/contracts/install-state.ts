import type { InstallScope } from "../contracts.js";
import type {
  InstallModelKey,
  InstallModelTransport,
} from "../model-catalog.js";

export interface ManagedInstallStateRecord {
  compatibilityAuditVersion: string;
  configTargets: {
    project?: string;
    user: string;
  };
  currentTransport: InstallModelTransport;
  installerPackageName: string;
  installerVersion: string;
  kiloCommand: string;
  kiloVersion: string;
  lastDurableSetupAt?: string;
  selectedModelKey: InstallModelKey;
  selectedScope: InstallScope;
}
