// Central permission table. Every server action / route handler should call can(...)
// rather than checking role strings inline — this is what makes RBAC auditable and
// makes adding a new role or permission a one-file change instead of a grep-and-pray.
//
// Three-tier model (phase-2 pivot):
//   GLOBAL_ADMIN — everything, including managing other admins
//   ADMIN        — day-to-day admin: manage users and integrations
//   REVIEWER     — participates in meetings, but cannot create/add/edit users

export type Role = "GLOBAL_ADMIN" | "ADMIN" | "REVIEWER";

export type Permission =
  | "meeting:create"
  | "meeting:view_transcript"
  | "meeting:delete"
  | "integration:manage"
  | "actionitem:push_to_tool"
  | "org:manage_members"
  | "org:manage_admins"
  | "org:view_audit_log"
  | "analytics:view_org_wide";

const PERMISSIONS: Record<Role, Permission[]> = {
  GLOBAL_ADMIN: [
    "meeting:create",
    "meeting:view_transcript",
    "meeting:delete",
    "integration:manage",
    "actionitem:push_to_tool",
    "org:manage_members",
    "org:manage_admins",
    "org:view_audit_log",
    "analytics:view_org_wide",
  ],
  ADMIN: [
    "meeting:create",
    "meeting:view_transcript",
    "integration:manage",
    "actionitem:push_to_tool",
    "org:manage_members",
    "org:view_audit_log",
    "analytics:view_org_wide",
  ],
  REVIEWER: [
    "meeting:create",
    "meeting:view_transcript",
    "actionitem:push_to_tool",
    "analytics:view_org_wide",
  ],
};

export const ROLE_LABELS: Record<Role, string> = {
  GLOBAL_ADMIN: "Global Admin",
  ADMIN: "Admin",
  REVIEWER: "Reviewer",
};

export function can(role: Role, permission: Permission): boolean {
  return PERMISSIONS[role]?.includes(permission) ?? false;
}

export function assertCan(role: Role, permission: Permission): void {
  if (!can(role, permission)) {
    throw new Error(`Forbidden: role ${role} lacks permission ${permission}`);
  }
}
