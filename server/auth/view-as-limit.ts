// docs/brief.md §7.4: a View-as session lasts at most an hour.
export const VIEW_AS_SECONDS = 60 * 60

// Better Auth's adminRoles: viewing as someone holding one of these also
// needs user:impersonate-admins.
export const VIEW_AS_ADMIN_ROLES = ["owner", "admin"] as const
