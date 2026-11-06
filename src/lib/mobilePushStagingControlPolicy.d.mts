export type MobilePushStagingControlMode =
  | "resource"
  | "schema"
  | "migration"
  | "acceptance";

export type MobilePushSyntheticIdentifiers = Readonly<{
  ok: boolean;
  workspaceId: string;
  ownerUserId: string;
  memberUserId: string;
  easProjectId: string;
  deviceId: string;
}>;

export const MOBILE_PUSH_STAGING_RESOURCE_CONFIRMATION: string;
export const MOBILE_PUSH_STAGING_MIGRATION_CONFIRMATION: string;
export const MOBILE_PUSH_STAGING_SCHEMA_CONFIRMATION: string;
export const MOBILE_PUSH_STAGING_ACCEPTANCE_CONFIRMATION: string;

export function evaluateMobilePushSyntheticIdentifiers(
  environment?: Record<string, unknown>,
): MobilePushSyntheticIdentifiers;

export function evaluateMobilePushStagingControlEnvironment(
  environment?: Record<string, unknown>,
  options?: { mode?: MobilePushStagingControlMode },
): Readonly<{
  ok: boolean;
  mode: string;
  writeEnabled?: boolean;
  syntheticIdentifiers?: MobilePushSyntheticIdentifiers;
  errors: readonly string[];
}>;
