export const PLATFORM_ADMIN_ROLE = "platform_admin";

export function isPlatformAdminRole(role: string): boolean {
  return role === PLATFORM_ADMIN_ROLE;
}
