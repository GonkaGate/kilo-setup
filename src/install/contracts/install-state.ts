import type {
  CuratedModelKey,
  CuratedModelTransport,
} from "../../constants/models.js";
import type { InstallScope } from "../contracts.js";

export interface ManagedInstallStateRecord {
  compatibilityAuditVersion: string;
  configTargets: {
    project?: string;
    user: string;
  };
  currentTransport: CuratedModelTransport;
  installerPackageName: string;
  installerVersion: string;
  kiloCommand: string;
  kiloVersion: string;
  lastDurableSetupAt?: string;
  selectedModelKey: CuratedModelKey;
  selectedScope: InstallScope;
}
