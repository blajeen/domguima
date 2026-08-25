export const adminConfig = {
  username: process.env.ADMIN_USERNAME?.trim() ?? "",
  passwordHash: process.env.ADMIN_PASSWORD_HASH?.trim() ?? "",
  sessionSecret: process.env.ADMIN_SESSION_SECRET?.trim() ?? "",
};

export function hasAdminConfig(): boolean {
  return Boolean(adminConfig.username && adminConfig.passwordHash && adminConfig.sessionSecret.length >= 32);
}

export function hasSupabaseConfig(): boolean {
  return Boolean(
    process.env.SUPABASE_URL?.trim() &&
      (process.env.SUPABASE_SECRET_KEY?.trim() || process.env.SUPABASE_SERVICE_ROLE_KEY?.trim()),
  );
}
