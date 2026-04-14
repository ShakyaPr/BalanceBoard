function hasValue(value) {
  return typeof value === "string" && value.trim() !== "";
}

export function buildDatabaseUrlFromEnv(env = process.env) {
  if (hasValue(env.DATABASE_URL)) {
    return env.DATABASE_URL;
  }

  if (!hasValue(env.DB_HOST)) {
    return null;
  }

  const user = env.DB_USER ?? "finance_user";
  const password = env.DB_PASSWORD ?? "finance_password";
  const host = env.DB_HOST;
  const port = env.DB_PORT ?? "5432";
  const database = env.DB_NAME ?? "finance_dashboard";
  const schema = env.DB_SCHEMA ?? "public";

  return `postgresql://${user}:${password}@${host}:${port}/${database}?schema=${schema}`;
}

export function configureDatabaseUrl(env = process.env) {
  const databaseUrl = buildDatabaseUrlFromEnv(env);

  if (databaseUrl) {
    env.DATABASE_URL = databaseUrl;
  }

  return env.DATABASE_URL;
}
