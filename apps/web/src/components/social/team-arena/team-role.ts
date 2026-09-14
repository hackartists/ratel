import type { TeamRole } from "@ratel/ts-bridges";

// app/ratel/src/features/social/pages/member/dto/team_role.rs — legacy
// permission helpers still used by the sidebar and the team list.
// `TeamGroupPermission` values are bit positions
// (app/ratel/src/features/posts/types/team_group_permission.rs).

const TEAM_ADMIN = 20;
const TEAM_EDIT = 21;

/** `Into<Vec<u8>> for TeamRole::Admin` (the `to_legacy_permissions` Admin set, ascending). */
export const TEAM_ROLE_ADMIN_PERMISSIONS: number[] = [0, 1, 2, 3, 10, 11, 12, 13, 21, 22];

/** `TeamRole::from_legacy_permissions` over a list of permission values. */
export function roleFromPermissions(permissions: number[]): TeamRole {
  if (permissions.includes(TEAM_ADMIN)) return "owner";
  if (permissions.includes(TEAM_EDIT)) return "admin";
  return "member";
}
