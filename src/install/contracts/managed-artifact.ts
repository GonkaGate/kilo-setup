export interface RestoreManagedArtifactFromBackupAction {
  backupPath: string;
  kind: "restore_backup";
  path: string;
}

export interface DeleteCreatedManagedArtifactFileAction {
  kind: "delete_created_file";
  path: string;
}

export type ManagedArtifactRollbackAction =
  | DeleteCreatedManagedArtifactFileAction
  | RestoreManagedArtifactFromBackupAction;

export interface UnchangedManagedArtifactWriteResult {
  backupPath: undefined;
  changed: false;
  created: false;
  path: string;
  rollbackAction: undefined;
}

export interface UpdatedExistingManagedArtifactWriteResult {
  backupPath: string;
  changed: true;
  created: false;
  path: string;
  rollbackAction: RestoreManagedArtifactFromBackupAction;
}

export interface CreatedManagedArtifactWriteResult {
  backupPath: undefined;
  changed: true;
  created: true;
  path: string;
  rollbackAction: DeleteCreatedManagedArtifactFileAction;
}

export type ChangedManagedArtifactWriteResult =
  | CreatedManagedArtifactWriteResult
  | UpdatedExistingManagedArtifactWriteResult;

export type ManagedArtifactWriteResult =
  | ChangedManagedArtifactWriteResult
  | UnchangedManagedArtifactWriteResult;
