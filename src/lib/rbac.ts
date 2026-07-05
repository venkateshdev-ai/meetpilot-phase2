// Central permission table. Every server action / route handler should call can(...)
// rather than checking role strings inline — this is what makes RBAC auditable and
// makes adding a new role or permission a one-file change instead of a grep-and-pray.

export type Role = "ORG_ADMIN" | "TEAM_LEAD" | "MEMBER" | "GUEST";

export type Permission =
  | "meeting:create"
  | "meeting:view_transcript"
  | "meeting:delete"
  | "room:manage_inventory"
  | "room:book"
  | "integration:manage"
  | "actionitem:push_to_tool"
  | "org:manage_members"
  | "org:view_audit_log"
  | "analytics:view_org_wide";

const PERMISSIONS: Record<Role, Permission[]> = {
  ORG_ADMIN: [
    "meeting:create",
    "meeting:view_transcript",
    "meeting:delete",
    "room:manage_inventory",
    "room:book",
    "integration:manage",
    "actionitem:push_to_tool",
    "org:manage_members",
    "org:view_audit_log",
    "analytics:view_org_wide",
  ],
  TEAM_LEAD: [
    "meeting:create",
    "meeting:view_transcript",
    "room:book",
    "actionitem:push_to_tool",
    "analytics:view_org_wide",
  ],
  MEMBER: ["meeting:create", "room:book", "actionitem:push_to_tool"],
  GUEST: ["room:book"],
};

export function can(role: Role, permission: Permission): boolean {
  return PERMISSIONS[role]?.includes(permission) ?? false;
}

export function assertCan(role: Role, permission: Permission): void {
  if (!can(role, permission)) {
    throw new Error(`Forbidden: role ${role} lacks permission ${permission}`);
  }
}
